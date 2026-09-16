import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { CognitoService } from './cognito.service';

// Standalone guard for the /auth/cognito/me demo route; independent of the local JwtAuthGuard.
@Injectable()
export class CognitoJwtGuard implements CanActivate {
  constructor(private readonly cognitoService: CognitoService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }
    const token = authHeader.slice('Bearer '.length);
    const payload = await this.cognitoService.verifyAccessToken(token);
    (request as any).user = payload;
    return true;
  }
}
