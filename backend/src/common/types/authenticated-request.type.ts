import { Request } from 'express';

export type AuthenticatedUser = {
  id: string;
  email: string;
  username?: string | null;
  sessionId: string;
};

export type AuthenticatedRequest = Request & {
  user: AuthenticatedUser;
  adminActorClientId?: string;
};
