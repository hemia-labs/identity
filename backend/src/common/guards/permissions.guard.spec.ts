import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';
import { RolesService } from '../../modules/roles/roles.service';

const createContext = (
  user: unknown = { id: 'user-id', sessionId: 'session-id', email: 'a@b.com' },
) =>
  ({
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  }) as never;

describe('PermissionsGuard', () => {
  it('allows exact permissions', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['users.read']),
    } as unknown as Reflector;
    const rolesService = {
      getEffectivePermissionCodes: jest.fn().mockResolvedValue(['users.read']),
    } as unknown as RolesService;
    const guard = new PermissionsGuard(reflector, rolesService);

    await expect(guard.canActivate(createContext())).resolves.toBe(true);
  });

  it('allows resource wildcards', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['users.delete']),
    } as unknown as Reflector;
    const rolesService = {
      getEffectivePermissionCodes: jest.fn().mockResolvedValue(['users.*']),
    } as unknown as RolesService;
    const guard = new PermissionsGuard(reflector, rolesService);

    await expect(guard.canActivate(createContext())).resolves.toBe(true);
  });

  it('allows global wildcards', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['users.delete']),
    } as unknown as Reflector;
    const rolesService = {
      getEffectivePermissionCodes: jest.fn().mockResolvedValue(['*']),
    } as unknown as RolesService;
    const guard = new PermissionsGuard(reflector, rolesService);

    await expect(guard.canActivate(createContext())).resolves.toBe(true);
  });

  it('rejects missing permissions', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['users.delete']),
    } as unknown as Reflector;
    const rolesService = {
      getEffectivePermissionCodes: jest.fn().mockResolvedValue(['users.read']),
    } as unknown as RolesService;
    const guard = new PermissionsGuard(reflector, rolesService);

    await expect(guard.canActivate(createContext())).rejects.toThrow(
      ForbiddenException,
    );
  });
});
