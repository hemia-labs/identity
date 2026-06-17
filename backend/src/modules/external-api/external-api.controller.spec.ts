import { validate } from 'class-validator';
import { ExternalApiController } from './external-api.controller';
import { EXTERNAL_SCOPES_KEY } from './decorators/external-scopes.decorator';
import { ExternalTeamsQueryDto } from './dtos/external-teams-query.dto';

describe('ExternalApiController teams', () => {
  const createController = () => {
    const externalApiService = {
      findTeams: jest.fn(),
      findTeamById: jest.fn(),
    };

    return {
      controller: new ExternalApiController(
        externalApiService as never,
        {} as never,
      ),
      externalApiService,
    };
  };

  it('requires teams read scope on team routes', () => {
    expect(
      Reflect.getMetadata(
        EXTERNAL_SCOPES_KEY,
        ExternalApiController.prototype.findTeams,
      ),
    ).toEqual(['identity.teams.read']);
    expect(
      Reflect.getMetadata(
        EXTERNAL_SCOPES_KEY,
        ExternalApiController.prototype.findTeamById,
      ),
    ).toEqual(['identity.teams.read']);
  });

  it('delegates team list calls', () => {
    const { controller, externalApiService } = createController();

    controller.findTeams({ tenantId: 'tenant-id' });

    expect(externalApiService.findTeams).toHaveBeenCalledWith({
      tenantId: 'tenant-id',
    });
  });

  it('delegates team detail calls', () => {
    const { controller, externalApiService } = createController();

    controller.findTeamById('team-id', { tenantId: 'tenant-id' });

    expect(externalApiService.findTeamById).toHaveBeenCalledWith('team-id', {
      tenantId: 'tenant-id',
    });
  });

  it('rejects missing tenantId on team list query', async () => {
    const dto = new ExternalTeamsQueryDto();

    await expect(validate(dto)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ property: 'tenantId' }),
      ]),
    );
  });

  it('rejects invalid UUIDs on team list query', async () => {
    const dto = Object.assign(new ExternalTeamsQueryDto(), {
      tenantId: 'not-a-uuid',
      organizationId: 'not-a-uuid',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual([
      'tenantId',
      'organizationId',
    ]);
  });
});
