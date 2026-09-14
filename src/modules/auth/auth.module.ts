import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { TokenService } from './token.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { RefreshToken } from './entities/refresh-token.entity';
import { AuthToken } from './entities/auth-token.entity';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.register({}), // signing options are supplied per-call in TokenService (RS256 keys)
    TypeOrmModule.forFeature([RefreshToken, AuthToken]),
  ],
  controllers: [AuthController],
  providers: [AuthService, TokenService, JwtStrategy, LocalStrategy],
  exports: [AuthService, TokenService],
})
export class AuthModule {}
