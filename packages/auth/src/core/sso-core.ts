import { randomUUID } from 'node:crypto';
import { decodeJwt } from 'jose';
import { UnauthorizedError } from './errors';
import { AccessClient } from './access-client';
import { buildPkce } from './pkce';
import { createVerifier, claimsToUser } from './jwks';
import type { SsoConfig } from './config';
import type { SessionStore } from './store';
import type { Session, TokenResponse, PkceState, SsoClaims } from './types';

const pkceKey = (state: string) => `sso:pkce:${state}`;
const sessionKey = (id: string) => `sso:session:${id}`;

/** Refresca una sesión estos milisegundos antes de que expire su access token. */
const REFRESH_WINDOW_MS = 60_000;

/**
 * Devuelve un destino de redirección seguro: solo se permiten rutas relativas del mismo
 * origen, evitando open redirects vía `returnTo`.
 */
const sanitizeReturnTo = (returnTo?: string): string | undefined =>
  returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : undefined;

const buildFrontendRedirect = (frontendUrl: string, returnTo?: string): string =>
  returnTo ? new URL(returnTo, frontendUrl).toString() : frontendUrl;

/** `true` cuando `expiresAt` (ISO) está a menos de {@link REFRESH_WINDOW_MS} de ahora. */
const shouldRefresh = (expiresAt: string) =>
  new Date(expiresAt).getTime() - Date.now() < REFRESH_WINDOW_MS;

/**
 * Motor de authorization-code (PKCE) de OAuth/OIDC, independiente del framework.
 *
 * Implementa todo el ciclo de vida del login —redirección de login, callback/intercambio
 * de tokens, búsqueda de sesión con auto-refresco y logout— contra un {@link SessionStore}.
 * Nunca toca objetos request/response HTTP: cada método devuelve una *intención* (una URL,
 * un valor de cookie, un destino de redirección) que un adaptador aplica a su framework. La
 * autorización y la resolución de usuario propias de la app se inyectan mediante los hooks
 * `authorize` y `onUserResolved` de {@link SsoConfig}.
 */
export class SsoCore {
  private readonly verifyAccessToken: (token: string) => Promise<SsoClaims>;
  private readonly accessClient?: AccessClient;

  constructor(
    private readonly cfg: SsoConfig,
    private readonly store: SessionStore,
  ) {
    this.verifyAccessToken = createVerifier(cfg);
    this.accessClient = cfg.access ? new AccessClient(cfg) : undefined;
  }

  /**
   * Inicia un login: genera el estado PKCE, lo persiste (TTL de 5 min) y construye la URL
   * del endpoint de autorización.
   *
   * @param returnTo - Ruta opcional del mismo origen a la que volver tras el login; se
   *   ignora si no es una ruta relativa segura.
   * @returns La URL de autorización a la que se debe redirigir el agente de usuario.
   */
  async buildLoginRedirect(returnTo?: string): Promise<{ url: string }> {
    const { state, nonce, codeVerifier, codeChallenge } = buildPkce();

    await this.store.set<PkceState>(
      pkceKey(state),
      { codeVerifier, nonce, returnTo: sanitizeReturnTo(returnTo) },
      300,
    );

    const url = new URL(this.cfg.authorizationUrl);
    url.searchParams.set('client_id', this.cfg.clientId);
    url.searchParams.set('redirect_uri', this.cfg.redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', this.cfg.scope);
    url.searchParams.set('code_challenge', codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
    url.searchParams.set('state', state);
    url.searchParams.set('nonce', nonce);

    return { url: url.toString() };
  }

  /**
   * Completa el callback del login: valida `state`, intercambia `code` por tokens, los
   * verifica, ejecuta los hooks de configuración y persiste una nueva sesión.
   *
   * @returns La `session` creada, el `cookieValue` que el adaptador debe fijar y la
   *   `redirectUrl` a la que devolver al usuario.
   * @throws {UnauthorizedError} si faltan parámetros o son inválidos, el estado expiró, o
   *   falló el intercambio/verificación de tokens.
   */
  async completeCallback(code?: string, state?: string): Promise<{
    session: Session;
    redirectUrl: string;
    cookieValue: string;
  }> {
    if (!code || !state) throw new UnauthorizedError('Missing code or state');

    const pkce = await this.store.get<PkceState>(pkceKey(state));
    await this.store.delete(pkceKey(state));
    if (!pkce) throw new UnauthorizedError('Invalid or expired state');

    const tokens = await this.exchangeCode(code, pkce.codeVerifier);
    const session = await this.createSession(tokens, pkce.nonce);
    await this.persistSession(session);

    return {
      session,
      cookieValue: session.id,
      redirectUrl: buildFrontendRedirect(this.cfg.frontendUrl, pkce.returnTo),
    };
  }

  /**
   * Carga la sesión correspondiente a un valor de cookie, refrescándola de forma
   * transparente cuando está dentro de la ventana de refresco.
   *
   * @throws {UnauthorizedError} si el id falta, es desconocido, o la sesión no se puede
   *   refrescar.
   */
  async getSession(sessionId?: string): Promise<Session> {
    if (!sessionId) throw new UnauthorizedError('Missing session');
    const session = await this.store.get<Session>(sessionKey(sessionId));
    if (!session) throw new UnauthorizedError('Invalid session');
    return shouldRefresh(session.expiresAt) ? this.refreshSession(session) : session;
  }

  /**
   * Revoca los tokens de la sesión en el SSO (best effort) y la elimina del almacén.
   *
   * @returns Si algún token se revocó correctamente de forma remota.
   */
  async logout(sessionId?: string): Promise<{ revoked: boolean; logoutUrl?: string }> {
    const session = sessionId
      ? await this.store.get<Session>(sessionKey(sessionId))
      : undefined;

    const revoked = await this.revokeAtSso(session ?? undefined);
    if (sessionId) await this.store.delete(sessionKey(sessionId));
    return { revoked, ...(this.cfg.logoutUrl && { logoutUrl: this.cfg.logoutUrl }) };
  }

  /** Construye la URL de frontend a la que redirigir cuando un login falla. */
  buildErrorRedirect(reason?: string): string {
    const url = new URL(this.cfg.frontendUrl);
    url.searchParams.set('error', reason ?? 'auth_failed');
    return url.toString();
  }

  /**
   * Verifica los tokens y ensambla una {@link Session}, aplicando los hooks de configuración
   * `authorize` y `onUserResolved`.
   *
   * @param expectedNonce - Si se indica junto a un `id_token`, el nonce del id token debe coincidir.
   * @param existingId - Reutiliza este id en el refresco; en otro caso se genera un nuevo UUID.
   */
  private async createSession(
    tokens: TokenResponse,
    expectedNonce?: string,
    existingId?: string,
  ): Promise<Session> {
    if (!tokens.access_token) throw new UnauthorizedError('Missing access token');
    if (expectedNonce && tokens.id_token)
      this.verifyIdTokenNonce(tokens.id_token, expectedNonce);

    const claims = await this.verifyAccessToken(tokens.access_token);
    const user = claimsToUser(claims);

    if (this.cfg.authorize && !(await this.cfg.authorize(claims)))
      throw new UnauthorizedError('Not authorized for this app');

    if (this.cfg.onUserResolved)
      user.internalUserId = (await this.cfg.onUserResolved(user)).internalUserId;

    const accessToken = this.accessClient
      ? await this.accessClient.exchangeUserToken(tokens.access_token)
      : undefined;
    const accessContext = accessToken
      ? await this.accessClient?.getContext(accessToken)
      : undefined;

    const expiresAt = claims.exp
      ? new Date(claims.exp * 1000).toISOString()
      : new Date(Date.now() + (tokens.expires_in ?? 900) * 1000).toISOString();

    return {
      id: existingId ?? randomUUID(),
      user,
      accessContext,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt,
    };
  }

  /** Intercambia el refresh token por una sesión nueva, conservando el id de sesión. */
  private async refreshSession(session: Session): Promise<Session> {
    if (!session.refreshToken) {
      await this.store.delete(sessionKey(session.id));
      throw new UnauthorizedError('Session expired');
    }
    const tokens = await this.requestToken({
      client_id: this.cfg.clientId,
      grant_type: 'refresh_token',
      refresh_token: session.refreshToken,
      ...(this.cfg.clientSecret && { client_secret: this.cfg.clientSecret }),
    });
    const refreshed = await this.createSession(tokens, undefined, session.id);
    refreshed.refreshToken = tokens.refresh_token ?? session.refreshToken;
    await this.persistSession(refreshed);
    return refreshed;
  }

  private exchangeCode(code: string, codeVerifier: string) {
    return this.requestToken({
      grant_type: 'authorization_code',
      client_id: this.cfg.clientId,
      redirect_uri: this.cfg.redirectUri,
      code,
      code_verifier: codeVerifier,
      ...(this.cfg.clientSecret && { client_secret: this.cfg.clientSecret }),
    });
  }

  private async requestToken(payload: Record<string, string>): Promise<TokenResponse> {
    const res = await fetch(this.cfg.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new UnauthorizedError('SSO token exchange failed');
    return res.json() as Promise<TokenResponse>;
  }

  private verifyIdTokenNonce(idToken: string, expectedNonce: string): void {
    let nonce: unknown;
    try {
      nonce = decodeJwt(idToken).nonce;
    } catch {
      throw new UnauthorizedError('Invalid id_token');
    }
    if (nonce !== expectedNonce) throw new UnauthorizedError('Nonce mismatch');
  }

  private persistSession(session: Session): Promise<void> {
    return this.store.set(sessionKey(session.id), session, this.cfg.sessionTtlSeconds);
  }

  private async revokeAtSso(session?: Session): Promise<boolean> {
    if (!session?.accessToken) return false;
    const a = await this.revokeToken(session.accessToken, 'access_token');
    const r = session.refreshToken
      ? await this.revokeToken(session.refreshToken, 'refresh_token')
      : false;
    return a || r;
  }

  private async revokeToken(token: string, hint: string): Promise<boolean> {
    if (!this.cfg.revocationUrl) return false;
    try {
      const res = await fetch(this.cfg.revocationUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          token_type_hint: hint,
          client_id: this.cfg.clientId,
          ...(this.cfg.clientSecret && { client_secret: this.cfg.clientSecret }),
        }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}

export { shouldRefresh, sanitizeReturnTo };
