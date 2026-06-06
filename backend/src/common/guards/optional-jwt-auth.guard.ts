import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser>(_error: Error | null, user: TUser | false) {
    return user || null;
  }

  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }
}
