import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { RedisService } from '../redis/redis.service';
import { TokenService } from './token.service';
import { RefreshToken } from './entities/refresh-token.entity';
import { AuthToken, AuthTokenType } from './entities/auth-token.entity';

jest.mock('argon2', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
  verify: jest.fn(),
  argon2id: 'argon2id',
}));

describe('AuthService', () => {
  let service: AuthService;
  let usersService: Partial<Record<keyof UsersService, jest.Mock>>;
  let tokenService: Partial<Record<keyof TokenService, jest.Mock>>;
  let redisService: Partial<Record<keyof RedisService, jest.Mock>>;
  let refreshTokenRepo: any;
  let authTokenRepo: any;

  const mockUser = {
    id: 'user-1',
    email: 'jane@example.com',
    roles: [{ id: 'role-1', name: 'user', permissions: [] }],
    isActive: true,
    passwordHash: 'hashed-password',
  };

  beforeEach(async () => {
    usersService = {
      create: jest.fn().mockResolvedValue(mockUser),
      findByEmail: jest.fn().mockResolvedValue(mockUser),
      findByIdOrFail: jest.fn().mockResolvedValue(mockUser),
      updatePassword: jest.fn(),
    };
    tokenService = {
      signAccessToken: jest.fn().mockReturnValue({ token: 'access-token', jti: 'jti-1', expiresIn: 900 }),
      generateOpaqueToken: jest.fn().mockReturnValue('raw-refresh-token'),
      hashToken: jest.fn().mockImplementation((t: string) => `hashed(${t})`),
      refreshTokenExpiryDate: jest.fn().mockReturnValue(new Date(Date.now() + 100000)),
    };
    redisService = {
      blacklistToken: jest.fn(),
      invalidateUserCache: jest.fn(),
    };
    refreshTokenRepo = {
      create: jest.fn().mockImplementation((v) => v),
      save: jest.fn().mockResolvedValue({}),
      findOne: jest.fn(),
      update: jest.fn(),
    };
    authTokenRepo = {
      create: jest.fn().mockImplementation((v) => v),
      save: jest.fn().mockResolvedValue({}),
      findOne: jest.fn(),
      update: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: TokenService, useValue: tokenService },
        { provide: RedisService, useValue: redisService },
        { provide: getRepositoryToken(RefreshToken), useValue: refreshTokenRepo },
        { provide: getRepositoryToken(AuthToken), useValue: authTokenRepo },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('register', () => {
    it('hashes the password with argon2id and issues a token pair', async () => {
      const result = await service.register({
        email: 'jane@example.com',
        password: 'StrongP@ss1',
      } as any);

      expect(argon2.hash).toHaveBeenCalledWith('StrongP@ss1', { type: 'argon2id' });
      expect(usersService.create).toHaveBeenCalled();
      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('raw-refresh-token');
      expect(result.tokenType).toBe('Bearer');
    });
  });

  describe('validateCredentials', () => {
    it('returns the user when the password matches', async () => {
      (argon2.verify as jest.Mock).mockResolvedValue(true);
      const result = await service.validateCredentials('jane@example.com', 'correct');
      expect(result).toEqual(mockUser);
    });

    it('returns null when the password does not match', async () => {
      (argon2.verify as jest.Mock).mockResolvedValue(false);
      const result = await service.validateCredentials('jane@example.com', 'wrong');
      expect(result).toBeNull();
    });

    it('returns null when the user does not exist', async () => {
      usersService.findByEmail!.mockResolvedValue(null);
      const result = await service.validateCredentials('missing@example.com', 'x');
      expect(result).toBeNull();
    });
  });

  describe('refresh (rotation + reuse detection)', () => {
    it('rotates a valid, non-revoked token and returns a new pair', async () => {
      refreshTokenRepo.findOne.mockResolvedValue({
        id: 'rt-1',
        userId: 'user-1',
        family: 'family-1',
        revoked: false,
        expiresAt: new Date(Date.now() + 100000),
      });

      const result = await service.refresh('raw-refresh-token');

      expect(refreshTokenRepo.update).toHaveBeenCalledWith('rt-1', { revoked: true });
      expect(result.accessToken).toBe('access-token');
    });

    it('rejects an unknown refresh token', async () => {
      refreshTokenRepo.findOne.mockResolvedValue(null);
      await expect(service.refresh('bogus')).rejects.toThrow(UnauthorizedException);
    });

    it('revokes the entire token family on reuse of an already-rotated token', async () => {
      refreshTokenRepo.findOne.mockResolvedValue({
        id: 'rt-1',
        userId: 'user-1',
        family: 'family-1',
        revoked: true, // already used once before -> reuse attempt
        expiresAt: new Date(Date.now() + 100000),
      });

      await expect(service.refresh('stolen-token')).rejects.toThrow(UnauthorizedException);
      expect(refreshTokenRepo.update).toHaveBeenCalledWith({ family: 'family-1' }, { revoked: true });
    });

    it('rejects an expired refresh token', async () => {
      refreshTokenRepo.findOne.mockResolvedValue({
        id: 'rt-1',
        userId: 'user-1',
        family: 'family-1',
        revoked: false,
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(service.refresh('expired')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('forgotPassword', () => {
    it('returns a reset token when the user exists', async () => {
      const result = await service.forgotPassword('jane@example.com');
      expect(authTokenRepo.save).toHaveBeenCalled();
      expect(result.resetToken).toBe('raw-refresh-token');
    });

    it('silently no-ops when the user does not exist (avoids email enumeration)', async () => {
      usersService.findByEmail!.mockResolvedValue(null);
      const result = await service.forgotPassword('nobody@example.com');
      expect(authTokenRepo.save).not.toHaveBeenCalled();
      expect(result).toEqual({});
    });
  });

  describe('resetPassword', () => {
    it('updates the password and invalidates all sessions for a valid token', async () => {
      authTokenRepo.findOne.mockResolvedValue({
        id: 'at-1',
        userId: 'user-1',
        used: false,
        type: AuthTokenType.PASSWORD_RESET,
        expiresAt: new Date(Date.now() + 100000),
      });

      await service.resetPassword('raw-token', 'NewStrongP@ss1');

      expect(usersService.updatePassword).toHaveBeenCalledWith('user-1', 'hashed-password');
      expect(authTokenRepo.update).toHaveBeenCalledWith('at-1', { used: true });
      expect(refreshTokenRepo.update).toHaveBeenCalledWith(
        { userId: 'user-1', revoked: false },
        { revoked: true },
      );
    });

    it('rejects an expired or already-used token', async () => {
      authTokenRepo.findOne.mockResolvedValue({
        id: 'at-1',
        userId: 'user-1',
        used: true,
        expiresAt: new Date(Date.now() + 100000),
      });

      await expect(service.resetPassword('raw-token', 'NewStrongP@ss1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('changePassword', () => {
    it('updates the password and revokes all sessions when the current password is correct', async () => {
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      await service.changePassword('user-1', 'CorrectCurrent1', 'NewStrongP@ss1');

      expect(usersService.updatePassword).toHaveBeenCalledWith('user-1', 'hashed-password');
      expect(refreshTokenRepo.update).toHaveBeenCalledWith(
        { userId: 'user-1', revoked: false },
        { revoked: true },
      );
    });

    it('rejects when the current password is wrong', async () => {
      (argon2.verify as jest.Mock).mockResolvedValue(false);

      await expect(service.changePassword('user-1', 'WrongPassword', 'NewStrongP@ss1')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(usersService.updatePassword).not.toHaveBeenCalled();
    });
  });

  describe('listSessions', () => {
    it('marks the session matching the current sessionId as current', async () => {
      refreshTokenRepo.find = jest.fn().mockResolvedValue([
        { id: 'rt-1', family: 'family-1', userAgent: 'Chrome', ipAddress: '1.1.1.1', createdAt: new Date(), expiresAt: new Date() },
        { id: 'rt-2', family: 'family-2', userAgent: 'Firefox', ipAddress: '2.2.2.2', createdAt: new Date(), expiresAt: new Date() },
      ]);

      const result = await service.listSessions('user-1', 'family-2');

      expect(result.find((s) => s.id === 'rt-1')?.current).toBe(false);
      expect(result.find((s) => s.id === 'rt-2')?.current).toBe(true);
    });
  });

  describe('revokeSession', () => {
    it('revokes a session owned by the user', async () => {
      refreshTokenRepo.findOne.mockResolvedValue({ id: 'rt-1', userId: 'user-1' });

      await service.revokeSession('user-1', 'rt-1');

      expect(refreshTokenRepo.update).toHaveBeenCalledWith('rt-1', { revoked: true });
    });

    it('throws when the session does not belong to the user (or does not exist)', async () => {
      refreshTokenRepo.findOne.mockResolvedValue(null);

      await expect(service.revokeSession('user-1', 'not-mine')).rejects.toThrow('Session not found');
    });
  });
});
