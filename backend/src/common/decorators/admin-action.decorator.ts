import { SetMetadata } from '@nestjs/common';

export const ADMIN_ACTION_KEY = 'admin_action';
export const AdminAction = (action: string) =>
  SetMetadata(ADMIN_ACTION_KEY, action);
