import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../../common/types/authenticated-request.type';

@Injectable()
export class AccountsService {
  getAccount(user: AuthenticatedUser) {
    return {
      id: user.id,
      email: user.email,
      username: user.username ?? null,
      sessionId: user.sessionId,
    };
  }
}
