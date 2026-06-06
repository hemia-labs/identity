import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { AuthenticatedRequest } from '../types/authenticated-request.type';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.user?.tenantId) {
      throw new ForbiddenException('Active tenant context is required');
    }

    return true;
  }
}
