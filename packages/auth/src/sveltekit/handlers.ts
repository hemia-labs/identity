import { redirect, isRedirect, json, type RequestEvent } from '@sveltejs/kit';
import { SsoCore } from '../core/session/sso-core';
import type { SsoConfig } from '../core/config';

const cookieOpts = (cfg: SsoConfig) => ({
  httpOnly: true,
  path: '/',
  sameSite: 'lax' as const,
  secure: cfg.cookieSecure,
  maxAge: cfg.sessionTtlSeconds,
});

/**
 * Handlers listos para usar en rutas `+server.ts` (`/auth/login`, `/auth/callback`,
 * `/auth/session`, `/auth/logout`). Pura cola de pegado: delegan toda la lógica en
 * {@link SsoCore} y aplican las intenciones devueltas (cookies, redirecciones) sobre
 * `event.cookies` / `Response` de SvelteKit.
 */
export function createSsoHandlers(core: SsoCore, cfg: SsoConfig) {
  return {
    /** `GET /auth/login` — redirige al endpoint de autorización del SSO. */
    async login(event: RequestEvent) {
      const returnTo = event.url.searchParams.get('returnTo') ?? undefined;
      const { url } = await core.buildLoginRedirect(returnTo);
      redirect(302, url);
    },

    /**
     * `GET /auth/callback` — completa el login, fija la cookie de sesión y redirige al
     * frontend. Si falla, redirige a la página de error en vez de lanzar una excepción.
     */
    async callback(event: RequestEvent) {
      const code = event.url.searchParams.get('code') ?? undefined;
      const state = event.url.searchParams.get('state') ?? undefined;
      try {
        const { redirectUrl, cookieValue } = await core.completeCallback(code, state);
        event.cookies.set(cfg.cookieName, cookieValue, cookieOpts(cfg));
        redirect(302, redirectUrl);
      } catch (err) {
        if (isRedirect(err)) throw err;
        redirect(302, core.buildErrorRedirect());
      }
    },

    /** `GET /auth/session` — devuelve el usuario autenticado; refresca si está cerca de expirar. */
    async session(event: RequestEvent) {
      const session = await core.getSession(event.cookies.get(cfg.cookieName));
      return json({ authenticated: true, user: session.user });
    },

    /** `POST /auth/logout` — revoca los tokens y borra la cookie. */
    async logout(event: RequestEvent) {
      const out = await core.logout(event.cookies.get(cfg.cookieName));
      event.cookies.delete(cfg.cookieName, { path: '/' });
      return json(out);
    },
  };
}
