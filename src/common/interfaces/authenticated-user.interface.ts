export interface AuthenticatedUser {
  id: string;
  email: string;
  roles: string[];
  permissions: string[];
  jti?: string;
  sessionId?: string;
}

export interface AccessTokenPayload {
  sub: string;
  email: string;
  roles: string[];
  permissions: string[];
  jti: string;
  sessionId: string;
  iss?: string;
  aud?: string;
  iat?: number;
  exp?: number;
}
