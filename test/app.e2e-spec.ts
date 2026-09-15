import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * End-to-end smoke test for the full register -> login -> refresh -> logout flow.
 * Requires a running Postgres + Redis (see docker-compose.yml) and a real .env,
 * since it boots the whole Nest application. Run with: npm run test:e2e
 */
describe('Auth flow (e2e)', () => {
  let app: INestApplication;
  const email = `e2e_${Date.now()}@example.com`;
  const password = 'StrongP@ss1';
  let refreshToken: string;
  let accessToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers a new user', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password, firstName: 'E2E', lastName: 'Test' })
      .expect(201);

    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    accessToken = res.body.accessToken;
    refreshToken = res.body.refreshToken;
  });

  it('rejects duplicate registration', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password })
      .expect(409);
  });

  it('logs in with correct credentials', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);

    expect(res.body.accessToken).toBeDefined();
  });

  it('rejects login with wrong password', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'WrongPassword1' })
      .expect(401);
  });

  it('fetches the current user with a valid access token', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.email).toBe(email);
    expect(res.body.passwordHash).toBeUndefined();
  });

  it('rejects requests with no token', async () => {
    await request(app.getHttpServer()).get('/api/v1/users/me').expect(401);
  });

  it('rotates the refresh token', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken })
      .expect(200);

    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.refreshToken).not.toBe(refreshToken);
  });

  it('rejects reuse of the old (already rotated) refresh token', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken })
      .expect(401);
  });
});
