import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().default(3000),
  API_PREFIX: Joi.string().default('api'),

  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().default(5432),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().allow('').required(),
  DB_NAME: Joi.string().required(),
  DB_SYNCHRONIZE: Joi.string().valid('true', 'false').default('false'),
  DB_LOGGING: Joi.string().valid('true', 'false').default('false'),

  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').optional(),

  JWT_PRIVATE_KEY_PATH: Joi.string().required(),
  JWT_PUBLIC_KEY_PATH: Joi.string().required(),
  JWT_ACCESS_TOKEN_TTL: Joi.number().default(900),
  JWT_ISSUER: Joi.string().default('nest-auth-service'),
  JWT_AUDIENCE: Joi.string().default('nest-auth-service-clients'),

  REFRESH_TOKEN_TTL_DAYS: Joi.number().default(7),

  THROTTLE_TTL: Joi.number().default(60),
  THROTTLE_LIMIT: Joi.number().default(10),

  CORS_ORIGIN: Joi.string().default('*'),
  BASE_URL: Joi.string().uri().optional(),

  AUTH_PROVIDER: Joi.string().valid('local', 'cognito').default('local'),
  COGNITO_ENABLED: Joi.string().valid('true', 'false').default('false'),
  AWS_REGION: Joi.string().default('eu-central-1'),
  COGNITO_USER_POOL_ID: Joi.string().allow('').optional(),
  COGNITO_CLIENT_ID: Joi.string().allow('').optional(),
  COGNITO_CLIENT_SECRET: Joi.string().allow('').optional(),
});
