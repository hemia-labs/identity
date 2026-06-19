import { ConfigError, UnauthorizedError } from './errors';
import type { SsoConfig } from './config';
import type { SessionStore } from './store';
import type { TokenResponse } from './types';

const SERVICE_TOKEN_KEY = 'sso:service-token';

/** Segundos que se restan al TTL del token como margen de seguridad, y a la vez su mínimo. */
const TOKEN_TTL_MARGIN_S = 30;

/**
 * Cliente máquina-a-máquina para llamar a la API del SSO en nombre de la propia app (sin
 * usuario ni sesión). Obtiene un token `client_credentials`, lo cachea en el
 * {@link SessionStore} hasta poco antes de que expire y expone un {@link SsoClient.request}
 * autenticado.
 *
 * Las apps construyen sus endpoints concretos sobre `request`; esta clase solo gestiona el
 * token cacheado y el fetch autenticado.
 */
export class SsoClient {
  constructor(
    private readonly cfg: SsoConfig,
    private readonly store: SessionStore,
  ) {}

  /**
   * Devuelve un access token de servicio válido, obteniendo y cacheando uno nuevo solo
   * cuando la caché está vacía. Las credenciales de servicio recurren por defecto a
   * `clientId`/`clientSecret` del login.
   *
   * @throws {ConfigError} si no hay credenciales de servicio configuradas.
   * @throws {UnauthorizedError} si el SSO rechaza las credenciales.
   */
  private async getServiceToken(): Promise<string> {
    const svc = this.cfg.service;
    if (!svc) throw new ConfigError('service credentials not configured');

    const cached = await this.store.get<{ accessToken: string }>(SERVICE_TOKEN_KEY);
    if (cached?.accessToken) return cached.accessToken;

    const clientId = svc.clientId ?? this.cfg.clientId;
    const clientSecret = svc.clientSecret ?? this.cfg.clientSecret;
    if (!clientId || !clientSecret)
      throw new ConfigError('service client credentials are missing');

    const res = await fetch(this.cfg.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
        scope: svc.scopes,
      }),
    });
    if (!res.ok) throw new UnauthorizedError('Identity token exchange failed');

    const tokens = (await res.json()) as TokenResponse;
    if (!tokens.access_token) throw new UnauthorizedError('Invalid token response');

    await this.store.set(
      SERVICE_TOKEN_KEY,
      { accessToken: tokens.access_token },
      Math.max((tokens.expires_in ?? 900) - TOKEN_TTL_MARGIN_S, TOKEN_TTL_MARGIN_S),
    );
    return tokens.access_token;
  }

  /**
   * Realiza una petición autenticada contra la API del SSO, resolviendo `path` relativo a
   * `service.apiBaseUrl` y adjuntando el bearer token cacheado.
   *
   * @typeParam T - Forma esperada de la respuesta JSON.
   * @throws {ConfigError} si `service.apiBaseUrl` no está configurado.
   * @throws {Error} si el estado de la respuesta no es OK.
   */
  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    if (!this.cfg.service) throw new ConfigError('service.apiBaseUrl not configured');
    const token = await this.getServiceToken();
    const res = await fetch(new URL(path, this.cfg.service.apiBaseUrl), {
      ...init,
      headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Identity external API failed');
    return res.json() as Promise<T>;
  }
}
