import { RolesService } from './roles.service';

describe('RolesService', () => {
  it('returns only the global wildcard for super admin permissions', async () => {
    const rolesRepository = {};
    const rolePermissionsRepository = {
      createQueryBuilder: jest.fn(),
    };
    const userRolesRepository = {
      find: jest.fn().mockResolvedValue([
        {
          roleId: 'super-admin-role-id',
          role: { code: 'SUPER_ADMIN' },
        },
      ]),
    };
    const service = new RolesService(
      rolesRepository as never,
      rolePermissionsRepository as never,
      userRolesRepository as never,
    );

    await expect(
      service.getEffectivePermissionCodes({
        id: 'user-id',
        email: 'admin@hemia.cloud',
        sessionId: 'session-id',
      }),
    ).resolves.toEqual(['*.*']);
    expect(rolePermissionsRepository.createQueryBuilder).not.toHaveBeenCalled();
  });
});
