import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  SignUpCommand,
  ConfirmSignUpCommand,
  AuthFlowType,
} from '@aws-sdk/client-cognito-identity-provider';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { createHmac } from 'crypto';

/**
 * Optional alternative identity provider. Disabled by default (COGNITO_ENABLED=false).
 * Demonstrates delegating auth to a managed provider instead of the local RS256/Argon2 flow,
 * while still fitting the same AuthenticatedUser shape the rest of the app expects.
 *
 * Cognito issues RS256-signed JWTs itself, verified here against the User Pool's public JWKS
 * (no secret ever leaves AWS) via `aws-jwt-verify`.
 */
@Injectable()
export class CognitoService {
  private readonly logger = new Logger(CognitoService.name);
  private readonly client: CognitoIdentityProviderClient;
  private readonly verifier: ReturnType<typeof CognitoJwtVerifier.create> | null;

  constructor(private readonly config: ConfigService) {
    const region = this.config.get<string>('cognito.region');
    this.client = new CognitoIdentityProviderClient({ region });

    const userPoolId = this.config.get<string>('cognito.userPoolId');
    const clientId = this.config.get<string>('cognito.clientId');
    this.verifier =
      userPoolId && clientId
        ? CognitoJwtVerifier.create({ userPoolId, tokenUse: 'access', clientId })
        : null;
  }

  private secretHash(username: string): string | undefined {
    const clientSecret = this.config.get<string>('cognito.clientSecret');
    const clientId = this.config.get<string>('cognito.clientId');
    if (!clientSecret || !clientId) return undefined;
    return createHmac('sha256', clientSecret).update(username + clientId).digest('base64');
  }

  async signUp(email: string, password: string) {
    const clientId = this.config.get<string>('cognito.clientId');
    return this.client.send(
      new SignUpCommand({
        ClientId: clientId,
        Username: email,
        Password: password,
        SecretHash: this.secretHash(email),
        UserAttributes: [{ Name: 'email', Value: email }],
      }),
    );
  }

  async confirmSignUp(email: string, code: string) {
    const clientId = this.config.get<string>('cognito.clientId');
    return this.client.send(
      new ConfirmSignUpCommand({
        ClientId: clientId,
        Username: email,
        ConfirmationCode: code,
        SecretHash: this.secretHash(email),
      }),
    );
  }

  async login(email: string, password: string) {
    const clientId = this.config.get<string>('cognito.clientId');
    const result = await this.client.send(
      new InitiateAuthCommand({
        AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
        ClientId: clientId,
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password,
          SECRET_HASH: this.secretHash(email) ?? '',
        },
      }),
    );
    return result.AuthenticationResult;
  }

  async verifyAccessToken(token: string) {
    if (!this.verifier) {
      throw new UnauthorizedException('Cognito is not configured on this server');
    }
    try {
      return await this.verifier.verify(token);
    } catch (err) {
      this.logger.warn(`Cognito token verification failed: ${(err as Error).message}`);
      throw new UnauthorizedException('Invalid Cognito token');
    }
  }
}
