import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser>(error: Error | null, user: TUser | false) {
    if (error || !user) {
      throw error ?? new UnauthorizedException('Invalid access token');
    }

    return user;
  }
}
