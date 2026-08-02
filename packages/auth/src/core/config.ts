import { ConfigError } from './errors';
import type { SsoClaims, AuthenticatedUser } from './types';

/**
 * Todo lo que una app cliente pasa para configurar el SSO. Objeto plano e independiente
 * del framework: el adaptador de NestJS lo construye a partir de `ConfigService`, pero el
 * núcleo nunca conoce ningún framework. Se valida una sola vez al arrancar mediante
 * {@link validateConfig}.
 */
export interface SsoConfig {
  issuer: string;
  clientId: string;
  clientSecret?: string;
  audience: string;
  jwksUrl: string;
  authorizationUrl: string;
  tokenUrl: string;
  /** Endpoint de revocación OAuth; si se omite, el logout omite la revocación remota. */
  revocationUrl?: string;
  logoutUrl?: string;

  /** URL de callback del backend registrada en el SSO. */
  redirectUri: string;
  /** Destino al que se envía al usuario tras un login exitoso. */
  frontendUrl: string;

  /** Scope OIDC base; la app añade los suyos (p. ej. `'docs.access'`). */
  scope: string;

  cookieName: string;
  sessionTtlSeconds: number;
  cookieSecure: boolean;

  /**
   * Configuración servicio-a-servicio (client_credentials). Solo es obligatoria si la app
   * usa {@link SsoClient}. Las credenciales recurren por defecto a `clientId`/`clientSecret`
   * del login.
   */
  service?: {
    apiBaseUrl: string;
    clientId?: string;
    clientSecret?: string;
    scopes: string;
  };

  access?: {
    apiBaseUrl: string;
    jwksUrl: string;
    audience: string;
  };

  /**
   * Control de autorización propio de la app, ejecutado durante la creación de la sesión.
   * Devuelve `false` para rechazar el login (p. ej. el usuario no tiene un permiso de la app).
   */
  authorize?: (claims: SsoClaims) => boolean | Promise<boolean>;

  /**
   * Resolución de usuario propia de la app, ejecutada durante la creación de la sesión. Mapea
   * el usuario del SSO a un registro interno; el id devuelto se guarda en
   * {@link AuthenticatedUser.internalUserId}.
   */
  onUserResolved?: (user: AuthenticatedUser) => Promise<{ internalUserId: string }>;
}

const REQUIRED: (keyof SsoConfig)[] = [
  'issuer', 'clientId', 'audience', 'jwksUrl', 'authorizationUrl',
  'tokenUrl', 'redirectUri', 'frontendUrl', 'scope', 'cookieName',
];

/**
 * Validación fail-fast de un {@link SsoConfig}. Devuelve el mismo objeto para encadenar.
 *
 * @throws {ConfigError} si falta un campo obligatorio o `sessionTtlSeconds` no es positivo.
 */
export function validateConfig(cfg: SsoConfig): SsoConfig {
  for (const key of REQUIRED) {
    if (!cfg[key]) throw new ConfigError(`Missing required SSO config: ${key}`);
  }
  if (!cfg.sessionTtlSeconds || cfg.sessionTtlSeconds <= 0)
    throw new ConfigError('sessionTtlSeconds must be a positive number');
  return cfg;
}
