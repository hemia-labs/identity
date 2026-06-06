import { MembershipStatus } from '../memberships/entities/membership.entity';
import { MembershipsService } from '../memberships/memberships.service';
import { SessionsService } from '../sessions/sessions.service';
import { AccountsService } from './accounts.service';

describe('AccountsService', () => {
  it('switches active context using an active membership index', async () => {
    const membershipsService = {
      findActiveAccountByIndex: jest.fn().mockResolvedValue({
        id: 'membership-id',
        tenantId: 'tenant-id',
        organizationId: 'organization-id',
        teamId: 'team-id',
        status: MembershipStatus.Active,
      }),
    } as unknown as MembershipsService;
    const sessionsService = {
      updateActiveContext: jest.fn().mockResolvedValue({ id: 'session-id' }),
    } as unknown as SessionsService;
    const service = new AccountsService(membershipsService, sessionsService);

    await expect(
      service.switchAccount('user-id', 'session-id', 0),
    ).resolves.toMatchObject({
      accountIndex: 0,
      tenantId: 'tenant-id',
      organizationId: 'organization-id',
      teamId: 'team-id',
      sessionId: 'session-id',
    });
    expect(sessionsService.updateActiveContext).toHaveBeenCalledWith(
      'session-id',
      {
        tenantId: 'tenant-id',
        organizationId: 'organization-id',
        teamId: 'team-id',
      },
    );
  });
});
