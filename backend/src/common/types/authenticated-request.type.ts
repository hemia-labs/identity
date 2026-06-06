import { Request } from 'express';

export type AuthenticatedUser = {
  id: string;
  email: string;
  username?: string | null;
  sessionId: string;
  tenantId?: string | null;
  organizationId?: string | null;
  teamId?: string | null;
};

export type AuthenticatedRequest = Request & {
  user: AuthenticatedUser;
};
