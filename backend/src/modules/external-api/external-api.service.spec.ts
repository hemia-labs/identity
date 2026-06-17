import { NotFoundException } from '@nestjs/common';
import { ExternalApiService } from './external-api.service';

const now = new Date('2026-01-01T00:00:00.000Z');
const team = {
  id: 'team-id',
  tenantId: 'tenant-id',
  organizationId: 'org-id',
  name: 'Docs',
  slug: 'docs',
  description: 'Docs team',
  createdAt: now,
  updatedAt: now,
};

describe('ExternalApiService teams', () => {
  const createService = () => {
    const teamsService = {
      findExternal: jest.fn(() => Promise.resolve([team])),
      findOne: jest.fn(() => Promise.resolve(team)),
    };

    return {
      service: new ExternalApiService(
        {} as never,
        {} as never,
        teamsService as never,
        {} as never,
      ),
      teamsService,
    };
  };

  it('lists teams by tenant', async () => {
    const { service, teamsService } = createService();

    await expect(service.findTeams({ tenantId: 'tenant-id' })).resolves.toEqual([
      {
        id: 'team-id',
        tenantId: 'tenant-id',
        organizationId: 'org-id',
        name: 'Docs',
        slug: 'docs',
        description: 'Docs team',
        createdAt: now,
        updatedAt: now,
      },
    ]);
    expect(teamsService.findExternal).toHaveBeenCalledWith({
      tenantId: 'tenant-id',
    });
  });

  it('filters teams by organization', async () => {
    const { service, teamsService } = createService();

    await service.findTeams({ tenantId: 'tenant-id', organizationId: 'org-id' });

    expect(teamsService.findExternal).toHaveBeenCalledWith({
      tenantId: 'tenant-id',
      organizationId: 'org-id',
    });
  });

  it('gets a team by id', async () => {
    const { service, teamsService } = createService();

    await expect(
      service.findTeamById('team-id', { tenantId: 'tenant-id' }),
    ).resolves.toMatchObject({ id: 'team-id', name: 'Docs' });
    expect(teamsService.findOne).toHaveBeenCalledWith('team-id', 'tenant-id');
  });

  it('returns 404 when team does not exist', async () => {
    const { service, teamsService } = createService();
    teamsService.findOne.mockRejectedValue(new NotFoundException('Team not found'));

    await expect(service.findTeamById('missing', {})).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
