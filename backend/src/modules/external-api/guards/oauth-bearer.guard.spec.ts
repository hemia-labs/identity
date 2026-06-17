import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OAuthBearerGuard } from './oauth-bearer.guard';

describe('OAuthBearerGuard external scopes', () => {
  const createContext = () =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { authorization: 'Bearer token' },
        }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    }) as never;

  it('rejects tokens without the required teams scope', async () => {
    const oauthService = {
      introspect: jest.fn(() =>
        Promise.resolve({
          active: true,
          scope: 'identity.users.read',
        }),
      ),
    };
    const reflector = {
      getAllAndOverride: jest.fn(() => ['identity.teams.read']),
    };
    const guard = new OAuthBearerGuard(
      oauthService as never,
      reflector as unknown as Reflector,
    );

    await expect(guard.canActivate(createContext())).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
