import { BadRequestException, Injectable } from '@nestjs/common';
import { MembershipEntity } from '../memberships/entities/membership.entity';
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
    return memberships.map((membership, index) =>
      this.toAccountResponse(membership, index),
    );
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
      ...this.toAccountResponse(membership, accountIndex),
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

  private toAccountResponse(
    membership: MembershipEntity,
    accountIndex: number,
  ) {
    return {
      accountIndex,
      membershipId: membership.id,
      tenantId: membership.tenantId,
      organizationId: membership.organizationId,
      teamId: membership.teamId,
      status: membership.status,
      tenant: membership.tenant
        ? {
            name: membership.tenant.name,
            slug: membership.tenant.slug,
            status: membership.tenant.status,
            plan: membership.tenant.plan ?? null,
          }
        : null,
      organization: membership.organization
        ? {
            name: membership.organization.name,
            slug: membership.organization.slug,
            legalName: membership.organization.legalName ?? null,
          }
        : null,
      team: membership.team
        ? {
            name: membership.team.name,
            slug: membership.team.slug,
            description: membership.team.description ?? null,
          }
        : null,
    };
  }
}
