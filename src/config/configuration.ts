import * as fs from 'fs';
import * as path from 'path';

function readKey(envPath: string | undefined): string {
  if (!envPath) return '';
  const resolved = path.isAbsolute(envPath) ? envPath : path.join(process.cwd(), envPath);
  try {
    return fs.readFileSync(resolved, 'utf8');
  } catch {
    // Key file may not exist yet (e.g. before `npm run keys:generate`); fail lazily at signing time.
    return '';
  }
}

export default () => ({
  app: {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    port: parseInt(process.env.PORT ?? '3000', 10),
    apiPrefix: process.env.API_PREFIX ?? 'api',
    corsOrigin: process.env.CORS_ORIGIN ?? '*',
    // Used to build absolute URLs (e.g. avatarUrl) returned to the client.
    baseUrl: process.env.BASE_URL ?? `http://localhost:${process.env.PORT ?? '3000'}`,
  },
  database: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    name: process.env.DB_NAME,
    synchronize: process.env.DB_SYNCHRONIZE === 'true',
    logging: process.env.DB_LOGGING === 'true',
  },
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  jwt: {
    privateKey: readKey(process.env.JWT_PRIVATE_KEY_PATH),
    publicKey: readKey(process.env.JWT_PUBLIC_KEY_PATH),
    accessTokenTtl: parseInt(process.env.JWT_ACCESS_TOKEN_TTL ?? '900', 10),
    issuer: process.env.JWT_ISSUER ?? 'nest-auth-service',
    audience: process.env.JWT_AUDIENCE ?? 'nest-auth-service-clients',
  },
  refreshToken: {
    ttlDays: parseInt(process.env.REFRESH_TOKEN_TTL_DAYS ?? '7', 10),
  },
  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL ?? '60', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT ?? '10', 10),
  },
  cognito: {
    enabled: process.env.COGNITO_ENABLED === 'true',
    region: process.env.AWS_REGION ?? 'eu-central-1',
    userPoolId: process.env.COGNITO_USER_POOL_ID,
    clientId: process.env.COGNITO_CLIENT_ID,
    clientSecret: process.env.COGNITO_CLIENT_SECRET,
  },
});
