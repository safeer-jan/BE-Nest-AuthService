import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import Redis from 'ioredis';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { APP_GUARD } from '@nestjs/core';
import configuration from './config/configuration';
import { validationSchema } from './config/validation.schema';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { RedisModule } from './modules/redis/redis.module';
import { REDIS_CLIENT } from './modules/redis/redis.constants';
import { CognitoModule } from './modules/cognito/cognito.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from './modules/auth/guards/roles.guard';
import { PermissionsGuard } from './modules/auth/guards/permissions.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration], validationSchema }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('database.host'),
        port: config.get('database.port'),
        username: config.get('database.username'),
        password: config.get('database.password'),
        database: config.get('database.name'),
        autoLoadEntities: true,
        synchronize: config.get('database.synchronize'),
        logging: config.get('database.logging'),
      }),
    }),
    RedisModule,
    ThrottlerModule.forRootAsync({
      inject: [ConfigService, REDIS_CLIENT],
      useFactory: (config: ConfigService, redisClient: Redis) => ({
        throttlers: [
          {
            ttl: config.get<number>('throttle.ttl', 60) * 1000,
            limit: config.get<number>('throttle.limit', 10),
          },
        ],
        // Shared store: keeps rate limits consistent across multiple app instances
        // (without this, each instance/process counts requests independently).
        storage: new ThrottlerStorageRedisService(redisClient),
      }),
    }),
    RbacModule,
    UsersModule,
    AuthModule,
    CognitoModule,
  ],
  providers: [
    // Global guard: every route requires a valid access token unless annotated with @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // Coarse role check (@Roles) -- kept for any legacy/simple checks.
    { provide: APP_GUARD, useClass: RolesGuard },
    // Fine-grained permission check (@Permissions) -- preferred for new endpoints.
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
