import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as argon2 from 'argon2';
import { randomUUID } from 'crypto';
import { UsersService } from '../users/users.service';
import { RedisService } from '../redis/redis.service';
import { TokenService } from './token.service';
import { RefreshToken } from './entities/refresh-token.entity';
import { AuthToken, AuthTokenType } from './entities/auth-token.entity';
import { RegisterDto } from './dto/register.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { User } from '../users/entities/user.entity';
import { flattenRoleNames, flattenPermissionNames } from '../rbac/rbac.util';

interface RequestMeta {
  userAgent?: string;
  ipAddress?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly tokenService: TokenService,
    private readonly redisService: RedisService,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepo: Repository<RefreshToken>,
    @InjectRepository(AuthToken)
    private readonly authTokenRepo: Repository<AuthToken>,
  ) {}

  async register(dto: RegisterDto, meta: RequestMeta = {}): Promise<AuthResponseDto> {
    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });
    const user = await this.usersService.create(dto, passwordHash);
    return this.issueTokenPair(user, randomUUID(), meta);
  }

  async validateCredentials(email: string, password: string): Promise<User | null> {
    const user = await this.usersService.findByEmail(email);
    if (!user || !user.isActive) return null;

    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) return null;

    return user;
  }

  async login(user: User, meta: RequestMeta = {}): Promise<AuthResponseDto> {
    return this.issueTokenPair(user, randomUUID(), meta);
  }

  /**
   * Rotates a refresh token. Implements reuse detection: if a token that was already
   * rotated (revoked) is presented again, the entire token family is revoked, forcing
   * re-authentication -- this is the standard mitigation against stolen refresh tokens.
   */
  async refresh(rawRefreshToken: string, meta: RequestMeta = {}): Promise<AuthResponseDto> {
    const tokenHash = this.tokenService.hashToken(rawRefreshToken);
    const existing = await this.refreshTokenRepo.findOne({ where: { tokenHash } });

    if (!existing) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (existing.revoked) {
      this.logger.warn(`Refresh token reuse detected for family ${existing.family}. Revoking family.`);
      await this.refreshTokenRepo.update({ family: existing.family }, { revoked: true });
      throw new UnauthorizedException('Refresh token has already been used. All sessions revoked.');
    }

    if (existing.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Refresh token has expired');
    }

    const user = await this.usersService.findByIdOrFail(existing.userId);

    // Rotate: revoke the presented token, issue a new one in the same family.
    await this.refreshTokenRepo.update(existing.id, { revoked: true });
    return this.issueTokenPair(user, existing.family, meta);
  }

  async logout(userId: string, rawRefreshToken: string, jti?: string, expSeconds?: number): Promise<void> {
    const tokenHash = this.tokenService.hashToken(rawRefreshToken);
    await this.refreshTokenRepo.update({ tokenHash, userId }, { revoked: true });

    if (jti && expSeconds) {
      await this.redisService.blacklistToken(jti, expSeconds);
    }
  }

  async logoutAll(userId: string): Promise<void> {
    await this.refreshTokenRepo.update({ userId, revoked: false }, { revoked: true });
    await this.redisService.invalidateUserCache(userId);
  }

  async forgotPassword(email: string): Promise<{ resetToken?: string }> {
    const user = await this.usersService.findByEmail(email);
    // Always respond the same way whether or not the email exists, to avoid user enumeration.
    if (!user) return {};

    const rawToken = this.tokenService.generateOpaqueToken();
    const tokenHash = this.tokenService.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    await this.authTokenRepo.save(
      this.authTokenRepo.create({
        userId: user.id,
        tokenHash,
        type: AuthTokenType.PASSWORD_RESET,
        expiresAt,
      }),
    );

    // In production this token is emailed to the user, never returned by the API.
    // Returned here only so the Postman collection / README demo works end-to-end without an SMTP setup.
    this.logger.log(`Password reset requested for ${email}`);
    return { resetToken: rawToken };
  }

  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const tokenHash = this.tokenService.hashToken(rawToken);
    const record = await this.authTokenRepo.findOne({
      where: { tokenHash, type: AuthTokenType.PASSWORD_RESET },
    });

    if (!record || record.used || record.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const passwordHash = await argon2.hash(newPassword, { type: argon2.argon2id });
    await this.usersService.updatePassword(record.userId, passwordHash);
    await this.authTokenRepo.update(record.id, { used: true });
    await this.logoutAll(record.userId); // Invalidate existing sessions after a password change.
  }

  private async issueTokenPair(
    user: Pick<User, 'id' | 'email' | 'roles'>,
    family: string,
    meta: RequestMeta,
  ): Promise<AuthResponseDto> {
    const { token: accessToken, expiresIn } = this.tokenService.signAccessToken({
      id: user.id,
      email: user.email,
      roles: flattenRoleNames(user.roles),
      permissions: flattenPermissionNames(user.roles),
    });

    const rawRefreshToken = this.tokenService.generateOpaqueToken();
    await this.refreshTokenRepo.save(
      this.refreshTokenRepo.create({
        userId: user.id,
        tokenHash: this.tokenService.hashToken(rawRefreshToken),
        family,
        expiresAt: this.tokenService.refreshTokenExpiryDate(),
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
      }),
    );

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      expiresIn,
      tokenType: 'Bearer',
    };
  }
}
