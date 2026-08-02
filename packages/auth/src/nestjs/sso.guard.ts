import {
  Injectable,
  Inject,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SsoCore, type AccessContext, type SsoConfig } from '../core/index';
import { SSO_CONFIG } from './tokens';
import { IS_PUBLIC_KEY, type RequestAuthContext } from './decorators';
import type { Request } from 'express';

/**
 * Guard de autenticación global. Lee la cookie de sesión, resuelve la sesión vía
 * {@link SsoCore} y adjunta el usuario a `req.user`. Las rutas marcadas con {@link Public}
 * se saltan la comprobación.
 */
@Injectable()
export class SsoAuthGuard implements CanActivate {
  // @Inject explícito en todos los params: así la DI no depende de emitDecoratorMetadata,
  // que esbuild/tsup no genera.
  constructor(
    @Inject(SsoCore) private readonly core: SsoCore,
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(SSO_CONFIG) private readonly cfg: SsoConfig,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<
      Request & {
        user?: unknown;
        ssoAuth?: RequestAuthContext;
        accessContext?: AccessContext;
        cookies?: Record<string, string>;
      }
    >();
    const cookie = req.cookies?.[this.cfg.cookieName];
    // getSession lanza si falta el id; tras él, `cookie` es un string válido.
    const session = await this.core.getSession(cookie);
    req.user = session.user;
    req.accessContext = session.accessContext;
    req.ssoAuth = {
      accessToken: session.accessToken,
      cookie: cookie as string,
      authorization: `Bearer ${session.accessToken}`,
    };
    return true;
  }
}
