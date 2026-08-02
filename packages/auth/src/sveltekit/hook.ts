import type { Handle } from '@sveltejs/kit';
import { SsoCore } from '../core/sso-core';
import type { SsoConfig } from '../core/config';
import type { AccessContext, AuthenticatedUser } from '../core/types';

/**
 * `Handle` de `hooks.server.ts`: resuelve la cookie de sesión y expone el usuario en
 * `event.locals.user` (refrescando si está cerca de expirar). No fuerza autenticación —
 * a diferencia del guard de NestJS, en SvelteKit cada `+page.server.ts`/`+server.ts` decide
 * si redirige cuando `locals.user` falta, siguiendo el idioma habitual de `locals` + `load`.
 *
 * La app debe declarar `user?: AuthenticatedUser` en `App.Locals` (`src/app.d.ts`); este
 * paquete no aumenta ese tipo global para no pisar el `app.d.ts` del consumidor.
 */
export function createSsoHook(core: SsoCore, cfg: SsoConfig): Handle {
  return async ({ event, resolve }) => {
    const locals = event.locals as {
      user?: AuthenticatedUser;
      accessContext?: AccessContext;
    };
    try {
      const session = await core.getSession(event.cookies.get(cfg.cookieName));
      locals.user = session.user;
      locals.accessContext = session.accessContext;
    } catch {
      locals.user = undefined;
      locals.accessContext = undefined;
    }
    return resolve(event);
  };
}
