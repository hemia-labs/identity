import { SetMetadata, createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AccessContext, AuthenticatedUser } from '../core/index';

/** Clave de metadatos fijada por {@link Public} y leída por {@link SsoAuthGuard}. */
export const IS_PUBLIC_KEY = 'isPublic';

/** Marca una ruta o controlador como que no requiere autenticación. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Contexto de auth que {@link SsoAuthGuard} adjunta al request (`req.ssoAuth`) para poder
 * reenviar el token del usuario a APIs de contexto-usuario.
 */
export interface RequestAuthContext {
  /** Access token del usuario, tomado de la sesión en el store (refrescado si estaba por expirar). */
  accessToken: string;
  /** Valor crudo de la cookie de sesión (el id de sesión opaco). */
  cookie: string;
  /** Header listo para reenviar: `Bearer <accessToken>`. */
  authorization: string;
}

/** Lo que inyecta {@link CurrentUser}: el usuario más el contexto de auth para reenviar el token. */
export type CurrentUserPayload = AuthenticatedUser & RequestAuthContext;

/** Forma del request que pueblan el guard y el decorador. */
type AuthedRequest = {
  user?: AuthenticatedUser;
  ssoAuth?: RequestAuthContext;
  accessContext?: AccessContext;
};

/**
 * Decorador de parámetro que inyecta el usuario autenticado más el contexto de auth
 * (`accessToken`, `cookie`, `authorization`) que {@link SsoAuthGuard} adjunta al request.
 * Devuelve `undefined` en rutas que no pasaron por el guard (p. ej. `@Public()`).
 */
export const CurrentUser = createParamDecorator(
  (_d: unknown, ctx: ExecutionContext): CurrentUserPayload | undefined => {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    if (!req.user) return undefined;
    return { ...req.user, ...(req.ssoAuth as RequestAuthContext) };
  },
);

export const CurrentAccessContext = createParamDecorator(
  (_d: unknown, ctx: ExecutionContext): AccessContext | undefined =>
    ctx.switchToHttp().getRequest<AuthedRequest>().accessContext,
);
