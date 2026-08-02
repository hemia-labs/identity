/** Payload crudo del JWT devuelto por el SSO, antes de mapearlo a {@link AuthenticatedUser}. */
export interface SsoClaims {
  sub?: string;
  email?: unknown;
  name?: unknown;
  /** Expiración como timestamp UNIX en segundos. */
  exp?: number;
  nonce?: unknown;
  [claim: string]: unknown;
}

/** Vista normalizada del principal autenticado, orientada a la app. */
export interface AuthenticatedUser {
  sub: string;
  iss?: string;
  email: string;
  name: string;
  /** Id de usuario propio de la app, poblado por el hook de configuración `onUserResolved`. */
  internalUserId?: string;
}

export interface AccessOrganizationContext {
  organization_id: string;
  organization_code: string;
  organization_name: string;
  organization_status: string;
  membership_id: string;
  membership_status: string;
  context_version: number;
  roles: string[];
  permissions: string[];
  product?: unknown;
}

export interface AccessContext {
  identity: {
    issuer: string;
    subject_id: string;
    type: string;
    identity_reference_id: string;
  };
  organizations: AccessOrganizationContext[];
}

/** Sesión de login persistida, indexada por {@link Session.id} en el {@link SessionStore}. */
export interface Session {
  id: string;
  user: AuthenticatedUser;
  accessContext?: AccessContext;
  contextToken?: string;
  accessToken: string;
  refreshToken?: string;
  /** Expiración del access token como cadena ISO 8601. */
  expiresAt: string;
}

/** Subconjunto de la respuesta del endpoint de tokens OAuth que consume este paquete. */
export interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  id_token?: string;
  /** Vida del token en segundos. */
  expires_in?: number;
  token_type?: string;
  issued_token_type?: string;
}

/** Estado PKCE transitorio guardado entre `/auth/login` y `/auth/callback`. */
export interface PkceState {
  codeVerifier: string;
  nonce: string;
  returnTo?: string;
}
