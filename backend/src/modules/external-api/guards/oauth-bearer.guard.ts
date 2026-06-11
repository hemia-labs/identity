import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { OAuthService } from '../../oauth/oauth.service';
import { EXTERNAL_SCOPES_KEY } from '../decorators/external-scopes.decorator';

type IntrospectionResult = {
  active: boolean;
  scope?: string;
  permissions?: string[];
  sub?: string;
  client_id?: string;
};

export type ExternalAuthContext = IntrospectionResult & {
  scopes: string[];
};

export type ExternalRequest = Request & {
  externalAuth?: ExternalAuthContext;
};

@Injectable()
export class OAuthBearerGuard implements CanActivate {
  constructor(
    private readonly oauthService: OAuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<ExternalRequest>();
    const token = this.extractBearerToken(request.headers.authorization);
    const introspection = (await this.oauthService.introspect({
      token,
    })) as IntrospectionResult;

    if (!introspection.active) {
      throw new UnauthorizedException('Invalid bearer token');
    }

    const scopes = this.parseScopes(introspection.scope);
    request.externalAuth = { ...introspection, scopes };
    const requiredScopes = this.reflector.getAllAndOverride<string[]>(
      EXTERNAL_SCOPES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredScopes?.length) {
      return true;
    }

    const permissions = new Set(introspection.permissions ?? []);
    const allowed = requiredScopes.every(
      (scope) => scopes.includes(scope) || this.hasPermission(permissions, scope),
    );

    if (!allowed) {
      throw new ForbiddenException('Insufficient scope');
    }

    return true;
  }

  private extractBearerToken(authorization?: string) {
    const [scheme, token] = authorization?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Bearer access token is required');
    }
    return token;
  }

  private parseScopes(scope?: string) {
    return (scope ?? '')
      .split(' ')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private hasPermission(permissions: Set<string>, permission: string) {
    const [resource] = permission.split('.');
    return (
      permissions.has(permission) ||
      permissions.has(`${resource}.*`) ||
      permissions.has('*.*')
    );
  }
}
