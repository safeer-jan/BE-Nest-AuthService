import { Module } from '@nestjs/common';
import { CognitoService } from './cognito.service';
import { CognitoController } from './cognito.controller';
import { CognitoJwtGuard } from './cognito-jwt.guard';

@Module({
  controllers: [CognitoController],
  providers: [CognitoService, CognitoJwtGuard],
  exports: [CognitoService],
})
export class CognitoModule {}
