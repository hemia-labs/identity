import {
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  Redirect,
  Inject,
} from '@nestjs/common';
import { SsoCore, type SsoConfig } from '../core/index';
import { SSO_CONFIG } from './tokens';
import { Public } from './decorators';
import type { Request, Response } from 'express';

const cookieOpts = (cfg: SsoConfig) => ({
  httpOnly: true,
  path: '/',
  sameSite: 'lax' as const,
  secure: cfg.cookieSecure,
  maxAge: cfg.sessionTtlSeconds * 1000,
});

/**
 * Monta la superficie HTTP del SSO en `/auth/*`. Pura cola de pegado: delega toda la lógica
 * en {@link SsoCore} y aplica las intenciones devueltas (cookies, redirecciones) a la
 * respuesta de Express. `SsoModule` lo registra automáticamente.
 */
@Public()
@Controller('auth')
export class SsoController {
  // @Inject explícito: la DI no depende de emitDecoratorMetadata (esbuild/tsup no lo genera).
  constructor(
    @Inject(SsoCore) private readonly core: SsoCore,
    @Inject(SSO_CONFIG) private readonly cfg: SsoConfig,
  ) {}

  /** `GET /auth/login` — redirige al endpoint de autorización del SSO. */
  @Get('login')
  @Redirect()
  async login(@Query('returnTo') returnTo?: string) {
    const { url } = await this.core.buildLoginRedirect(returnTo);
    return { statusCode: 302, url };
  }

  /**
   * `GET /auth/callback` — completa el login, fija la cookie de sesión y redirige al
   * frontend. Si falla, redirige a la página de error en vez de lanzar una excepción.
   */
  @Get('callback')
  @Redirect()
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const { redirectUrl, cookieValue } = await this.core.completeCallback(code, state);
      res.cookie(this.cfg.cookieName, cookieValue, cookieOpts(this.cfg));
      return { statusCode: 302, url: redirectUrl };
    } catch {
      return { statusCode: 302, url: this.core.buildErrorRedirect() };
    }
  }

  /** `GET /auth/session` — devuelve el usuario autenticado; refresca si está cerca de expirar. */
  @Get('session')
  async session(@Req() req: Request & { cookies?: Record<string, string> }) {
    const session = await this.core.getSession(req.cookies?.[this.cfg.cookieName]);
    return { authenticated: true, user: session.user };
  }

  /** `POST /auth/logout` — revoca los tokens y borra la cookie. */
  @Post('logout')
  async logout(
    @Req() req: Request & { cookies?: Record<string, string> },
    @Res({ passthrough: true }) res: Response,
  ) {
    const out = await this.core.logout(req.cookies?.[this.cfg.cookieName]);
    res.clearCookie(this.cfg.cookieName, cookieOpts(this.cfg));
    return out;
  }
}
