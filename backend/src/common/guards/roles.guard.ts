import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AuthenticatedRequest } from '../types/authenticated-request.type';
import { RolesService } from '../../modules/roles/roles.service';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rolesService: RolesService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user) {
      throw new ForbiddenException('Authenticated user is required');
    }

    const roleCodes = await this.rolesService.getEffectiveRoleCodes(
      request.user,
    );
    const allowed = requiredRoles.some((role) => roleCodes.includes(role));

    if (!allowed) {
      throw new ForbiddenException('Insufficient role');
    }

    return true;
  }
}
