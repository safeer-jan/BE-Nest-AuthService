import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TokenService } from './token.service';

describe('TokenService', () => {
  let service: TokenService;
  let jwtService: Partial<Record<keyof JwtService, jest.Mock>>;

  const config: Record<string, unknown> = {
    'jwt.accessTokenTtl': 900,
    'jwt.privateKey': 'PRIVATE_KEY',
    'jwt.publicKey': 'PUBLIC_KEY',
    'jwt.issuer': 'nest-auth-service',
    'jwt.audience': 'nest-auth-service-clients',
    'refreshToken.ttlDays': 7,
  };

  beforeEach(async () => {
    jwtService = { sign: jest.fn().mockReturnValue('signed.jwt.token'), verify: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenService,
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: { get: (key: string) => config[key] } },
      ],
    }).compile();

    service = module.get(TokenService);
  });

  it('signs an access token with the RS256 algorithm and the private key', () => {
    const result = service.signAccessToken({
      id: 'u1',
      email: 'a@b.com',
      roles: ['user'],
      permissions: ['users:read'],
      sessionId: 'session-1',
    });

    expect(jwtService.sign).toHaveBeenCalledWith(
      expect.objectContaining({ sub: 'u1', email: 'a@b.com', roles: ['user'] }),
      expect.objectContaining({ algorithm: 'RS256', privateKey: 'PRIVATE_KEY', expiresIn: 900 }),
    );
    expect(result.token).toBe('signed.jwt.token');
    expect(result.expiresIn).toBe(900);
    expect(result.jti).toEqual(expect.any(String));
  });

  it('generates unique opaque refresh tokens', () => {
    const a = service.generateOpaqueToken();
    const b = service.generateOpaqueToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[a-f0-9]+$/);
  });

  it('hashes the same input deterministically with SHA-256', () => {
    const hashA = service.hashToken('same-value');
    const hashB = service.hashToken('same-value');
    expect(hashA).toBe(hashB);
    expect(hashA).toHaveLength(64);
  });

  it('produces a refresh token expiry roughly ttlDays in the future', () => {
    const expiry = service.refreshTokenExpiryDate();
    const expectedMs = 7 * 24 * 60 * 60 * 1000;
    expect(expiry.getTime() - Date.now()).toBeGreaterThan(expectedMs - 5000);
    expect(expiry.getTime() - Date.now()).toBeLessThan(expectedMs + 5000);
  });
});
