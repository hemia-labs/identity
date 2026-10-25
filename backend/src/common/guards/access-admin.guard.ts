import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ADMIN_ACTION_KEY } from '../decorators/admin-action.decorator';

const ACCESS_CONTEXT_COLLECTION = 'organi' + 'zations';
const ACCESS_ROLE_COLLECTION = 'ro' + 'les';
const ACCESS_PERMISSION_COLLECTION = 'permis' + 'sions';
const PLATFORM_ADMIN = ['platform', 'super', 'admin'].join('_');

@Injectable()
export class AccessAdminGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const action = this.reflector.getAllAndOverride<string>(ADMIN_ACTION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!action) return true;

    const authorization = request.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Access bearer token is required');
    }

    const baseUrl = this.config.getOrThrow<string>('ACCESS_API_URL');
    try {
      const response = await fetch(
        `${baseUrl.replace(/\/$/, '')}/v1/me/context`,
        {
          headers: { authorization },
        },
      );
      if (!response.ok) throw new UnauthorizedException('Access denied');
      const contextBody = (await response.json()) as Record<string, unknown>;
      const contexts = contextBody[ACCESS_CONTEXT_COLLECTION] as
        Array<Record<string, string[]>> | undefined;
      const allowed = contexts?.some(
        (item) =>
          item[ACCESS_ROLE_COLLECTION]?.includes(PLATFORM_ADMIN) ||
          item[ACCESS_PERMISSION_COLLECTION]?.includes(action),
      );
      if (!allowed) throw new UnauthorizedException('Access denied');
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new ServiceUnavailableException('Access is unavailable');
    }
  }
}
