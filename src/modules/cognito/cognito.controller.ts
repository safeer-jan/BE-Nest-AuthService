import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CognitoService } from './cognito.service';
import { CognitoSignUpDto, CognitoConfirmDto, CognitoLoginDto } from './dto/cognito-auth.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CognitoJwtGuard } from './cognito-jwt.guard';

// All routes live under /auth/cognito and are entirely optional (see COGNITO_ENABLED in .env).
@ApiTags('auth-cognito (optional)')
@Public() // bypasses the local RS256 JwtAuthGuard; this module verifies Cognito's own tokens instead
@Controller({ path: 'auth/cognito', version: '1' })
export class CognitoController {
  constructor(private readonly cognitoService: CognitoService) {}

  @Post('register')
  @ApiOperation({ summary: '[optional/AWS Cognito] Sign up a user in the Cognito User Pool' })
  signUp(@Body() dto: CognitoSignUpDto) {
    return this.cognitoService.signUp(dto.email, dto.password);
  }

  @Post('confirm')
  @ApiOperation({ summary: '[optional/AWS Cognito] Confirm sign-up with the emailed code' })
  confirm(@Body() dto: CognitoConfirmDto) {
    return this.cognitoService.confirmSignUp(dto.email, dto.code);
  }

  @Post('login')
  @ApiOperation({ summary: '[optional/AWS Cognito] Authenticate against the Cognito User Pool' })
  login(@Body() dto: CognitoLoginDto) {
    return this.cognitoService.login(dto.email, dto.password);
  }

  @Get('me')
  @UseGuards(CognitoJwtGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '[optional/AWS Cognito] Verify a Cognito access token' })
  me() {
    return { message: 'Cognito token is valid' };
  }
}
