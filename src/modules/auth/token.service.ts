import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomUUID, randomBytes, createHash } from 'crypto';
import { AccessTokenPayload } from '../../common/interfaces/authenticated-user.interface';

export interface TokenSubject {
  id: string;
  email: string;
  roles: string[];
  permissions: string[];
  sessionId: string;
}

export interface SignedAccessToken {
  token: string;
  jti: string;
  expiresIn: number;
}

/**
 * Signs/verifies RS256 access tokens and issues opaque refresh tokens.
 *
 * Why RS256 (RSA-SHA256, asymmetric) instead of HS256:
 *  - The private key lives only on this auth service and is used to SIGN tokens.
 *  - Every other service (this repo's fullstack/backend projects) only needs the PUBLIC key
 *    to VERIFY tokens locally, with no network call back to this service and no risk of
 *    leaking a shared secret into multiple codebases.
 *  - It is also what AWS Cognito issues by default, so the optional Cognito provider in this
 *    project can be verified with the exact same JwtStrategy shape.
 *
 * Refresh tokens are intentionally NOT JWTs: they are opaque random strings, stored server-side
 * as a SHA-256 hash (see RefreshToken entity), so a leaked database dump never exposes usable
 * bearer tokens.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  signAccessToken(user: TokenSubject): SignedAccessToken {
    const jti = randomUUID();
    const expiresIn = this.configService.get<number>('jwt.accessTokenTtl', 900);
    const payload: Omit<AccessTokenPayload, 'iat' | 'exp' | 'iss' | 'aud'> = {
      sub: user.id,
      email: user.email,
      roles: user.roles,
      permissions: user.permissions,
      jti,
      sessionId: user.sessionId,
    };

    const token = this.jwtService.sign(payload, {
      algorithm: 'RS256',
      privateKey: this.configService.get<string>('jwt.privateKey'),
      expiresIn,
      issuer: this.configService.get<string>('jwt.issuer'),
      audience: this.configService.get<string>('jwt.audience'),
    });

    return { token, jti, expiresIn };
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    return this.jwtService.verify<AccessTokenPayload>(token, {
      algorithms: ['RS256'],
      publicKey: this.configService.get<string>('jwt.publicKey'),
      issuer: this.configService.get<string>('jwt.issuer'),
      audience: this.configService.get<string>('jwt.audience'),
    });
  }

  generateOpaqueToken(): string {
    return randomBytes(48).toString('hex');
  }

  hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  refreshTokenExpiryDate(): Date {
    const days = this.configService.get<number>('refreshToken.ttlDays', 7);
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }
}
