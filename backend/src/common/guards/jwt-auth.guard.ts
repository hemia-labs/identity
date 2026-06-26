import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { ACCESS_TOKEN_COOKIE } from '../../modules/auth/constants/auth.constants';
import { OAuthService } from '../../modules/oauth/oauth.service';

type IntrospectResult = {
  active: boolean;
  sub?: string;
  email?: string;
  session_id?: string;
  tenant_id?: string | null;
  organization_id?: string | null;
  team_id?: string | null;
};

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly moduleRef: ModuleRef) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<
      Request & { user?: unknown; cookies?: Record<string, string> }
    >();
    const bearer = this.bearerToken(req);

    console.log('[jwt auth guard ] ', bearer);
     console.log('[jwt auth cookies ] ', req.cookies?.[ACCESS_TOKEN_COOKIE]);
    // Cookie de sesión (o sin Bearer) → ruta HS256 actual, sin cambios.
    if (req.cookies?.[ACCESS_TOKEN_COOKIE] || !bearer) {
      return (await super.canActivate(context)) as boolean;
    }

    // Bearer → introspección OAuth (cliente external/admin).
    // ponytail: OAuthService resuelto por ModuleRef para esquivar el ciclo AuthModule<->OAuthModule.
    const oauth = this.moduleRef.get(OAuthService, { strict: false });
    const intro = (await oauth.introspect({ token: bearer })) as IntrospectResult;
    console.log('[jwt auth intro ] ', intro);
    if (intro.active && intro.sub && intro.session_id) {
      req.user = {
        id: intro.sub,
        email: intro.email,
        username: null,
        sessionId: intro.session_id,
        tenantId: intro.tenant_id ?? null,
        organizationId: intro.organization_id ?? null,
        teamId: intro.team_id ?? null,
      };
      this.applyTenantOverride(req);
      return true;
    }

    // Fallback: token interno HS256 enviado como Bearer.
    return (await super.canActivate(context)) as boolean;
  }

  handleRequest<TUser>(error: Error | null, user: TUser | false) {
    if (error || !user) {
      throw error ?? new UnauthorizedException('Invalid access token');
    }

    return user;
  }

  private bearerToken(req: Request): string | null {
    const [scheme, token] = req.headers.authorization?.split(' ') ?? [];
    return scheme === 'Bearer' && token ? token : null;
  }

  // ponytail: override solo en la rama Bearer; el front por cookie no cambia de comportamiento.
  private applyTenantOverride(
    req: Request & { user?: { tenantId?: string | null } },
  ) {
    const t = req.headers['x-tenant-id'];
    if (t && req.user) req.user.tenantId = Array.isArray(t) ? t[0] : t;
  }
}
