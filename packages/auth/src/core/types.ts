/** Payload crudo del JWT devuelto por el SSO, antes de mapearlo a {@link AuthenticatedUser}. */
export interface SsoClaims {
  sub?: string;
  email?: unknown;
  name?: unknown;
  tenant_id?: unknown;
  organization_id?: unknown;
  team_id?: unknown;
  roles?: unknown;
  permissions?: unknown;
  /** Expiración como timestamp UNIX en segundos. */
  exp?: number;
  nonce?: unknown;
  [claim: string]: unknown;
}

/** Vista normalizada del principal autenticado, orientada a la app. */
export interface AuthenticatedUser {
  ssoUserId: string;
  email: string;
  name: string;
  tenantId: string;
  organizationId: string;
  teamId: string;
  roles: string[];
  permissions: string[];
  /** Id de usuario propio de la app, poblado por el hook de configuración `onUserResolved`. */
  internalUserId?: string;
}

/** Sesión de login persistida, indexada por {@link Session.id} en el {@link SessionStore}. */
export interface Session {
  id: string;
  user: AuthenticatedUser;
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
}

/** Estado PKCE transitorio guardado entre `/auth/login` y `/auth/callback`. */
export interface PkceState {
  codeVerifier: string;
  nonce: string;
  returnTo?: string;
}
