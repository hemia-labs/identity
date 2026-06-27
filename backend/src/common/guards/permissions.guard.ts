import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { AuthenticatedRequest } from '../types/authenticated-request.type';
import { RolesService } from '../../modules/roles/roles.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rolesService: RolesService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user) {
      throw new ForbiddenException('Authenticated user is required');
    }

    const grantedPermissions =
      await this.rolesService.getEffectivePermissionCodes(request.user);

    const granted = new Set(grantedPermissions);
    const allowed = requiredPermissions.every((permission) =>
      this.hasPermission(granted, permission),
    );

    if (!allowed) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }

  private hasPermission(granted: Set<string>, permission: string) {
    const [resource] = permission.split('.');
    return (
      granted.has('*') ||
      granted.has(permission) ||
      granted.has(`${resource}.*`) ||
      granted.has('*.*')
    );
  }
}
