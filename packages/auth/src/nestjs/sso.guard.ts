import {
  Injectable,
  Inject,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SsoCore, type SsoConfig } from '../core/index';
import { SSO_CONFIG } from './tokens';
import { IS_PUBLIC_KEY } from './decorators';
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

    const req = ctx
      .switchToHttp()
      .getRequest<Request & { user?: unknown; cookies?: Record<string, string> }>();
    const session = await this.core.getSession(req.cookies?.[this.cfg.cookieName]);
    req.user = session.user;
    return true;
  }
}
