import { BadRequestException, Injectable } from '@nestjs/common';
import { MembershipsService } from '../memberships/memberships.service';
import { SessionsService } from '../sessions/sessions.service';

@Injectable()
export class AccountsService {
  constructor(
    private readonly membershipsService: MembershipsService,
    private readonly sessionsService: SessionsService,
  ) {}

  async listAccounts(userId: string) {
    const memberships = await this.membershipsService.findActiveByUser(userId);
    return memberships.map((membership, index) => ({
      accountIndex: index,
      membershipId: membership.id,
      tenantId: membership.tenantId,
      organizationId: membership.organizationId,
      teamId: membership.teamId,
      status: membership.status,
    }));
  }

  async switchAccount(userId: string, sessionId: string, accountIndex: number) {
    if (accountIndex < 0) {
      throw new BadRequestException('Invalid account index');
    }

    const membership = await this.membershipsService.findActiveAccountByIndex(
      userId,
      accountIndex,
    );
    const session = await this.sessionsService.updateActiveContext(sessionId, {
      tenantId: membership.tenantId,
      organizationId: membership.organizationId,
      teamId: membership.teamId,
    });

    return {
      accountIndex,
      membershipId: membership.id,
      tenantId: membership.tenantId,
      organizationId: membership.organizationId,
      teamId: membership.teamId,
      sessionId: session?.id ?? sessionId,
    };
  }

  async removeAccount(userId: string, accountIndex: number) {
    await this.membershipsService.findActiveAccountByIndex(
      userId,
      accountIndex,
    );
    return { removed: true };
  }

  getActiveAccount(
    tenantId?: string | null,
    organizationId?: string | null,
    teamId?: string | null,
  ) {
    return {
      tenantId: tenantId ?? null,
      organizationId: organizationId ?? null,
      teamId: teamId ?? null,
    };
  }
}
