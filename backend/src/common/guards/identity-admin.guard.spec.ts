import { createHash } from 'crypto';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IsNull, Repository } from 'typeorm';
import { OAuthTokenEntity } from '../../modules/oauth/entities/oauth-token.entity';
import {
  OAuthClientEntity,
  OAuthClientStatus,
} from '../../modules/oauth/entities/oauth-client.entity';
import { AccessAdminGuard } from './access-admin.guard';
import { IdentityAdminGuard } from './identity-admin.guard';

const token = 'opaque-token';
const tokenHash = createHash('sha256').update(token).digest('hex');

const createContext = () =>
  ({
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => ({
        headers: { authorization: `Bearer ${token}` },
      }),
    }),
  }) as never;

const createGuard = (
  storedToken: Partial<OAuthTokenEntity> | null,
  client: Partial<OAuthClientEntity> = {},
) => {
  const tokensRepository = {
    findOne: jest.fn().mockResolvedValue(storedToken),
  };
  const clientsRepository = {
    findOne: jest.fn().mockResolvedValue({
      clientId: storedToken?.clientId,
      audience: 'identity-api',
      status: OAuthClientStatus.Active,
      ...client,
    }),
  } as unknown as Repository<OAuthClientEntity>;
  const accessAdminGuard = {
    canActivate: jest.fn(),
  };
  const guard = new IdentityAdminGuard(
    tokensRepository as unknown as Repository<OAuthTokenEntity>,
    clientsRepository,
    {
      getAllAndOverride: jest.fn().mockReturnValue('identity.users.read'),
    } as unknown as Reflector,
    accessAdminGuard as unknown as AccessAdminGuard,
  );

  return { accessAdminGuard, guard, tokensRepository };
};

describe('IdentityAdminGuard', () => {
  it.each([
    ['user-id', 'session-id', true],
    ['other-user', 'session-id', false],
    ['user-id', 'other-session', false],
  ])(
    'binds administrative bearer to authenticated cookie %s/%s',
    async (userId, sessionId, allowed) => {
      const { guard, accessAdminGuard } = createGuard({
        tokenHash,
        clientId: 'access',
        userId: 'user-id',
        sessionId: 'session-id',
        expiresAt: new Date(Date.now() + 60_000),
      });
      const request = {
        headers: { authorization: `Bearer ${token}` },
        cookies: { access_token: 'cookie' },
        user: { id: userId, sessionId },
      };
      const context = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: () => ({ getRequest: () => request }),
      } as never;
      const passport = jest
        .spyOn(
          Object.getPrototypeOf(IdentityAdminGuard.prototype),
          'canActivate',
        )
        .mockResolvedValue(true);
      jest.mocked(accessAdminGuard.canActivate).mockResolvedValue(true);
      try {
        if (allowed) {
          await expect(guard.canActivate(context)).resolves.toBe(true);
          expect(accessAdminGuard.canActivate).toHaveBeenCalledWith(context);
        } else {
          await expect(guard.canActivate(context)).rejects.toThrow(
            UnauthorizedException,
          );
          expect(accessAdminGuard.canActivate).not.toHaveBeenCalled();
        }
      } finally {
        passport.mockRestore();
      }
    },
  );

  it('allows active machine tokens with the required scope', async () => {
    const { accessAdminGuard, guard, tokensRepository } = createGuard({
      tokenHash,
      clientId: 'identity-admin-service',
      scope: 'identity.users.read',
      expiresAt: new Date(Date.now() + 60_000),
    });

    await expect(guard.canActivate(createContext())).resolves.toBe(true);
    expect(tokensRepository.findOne).toHaveBeenCalledWith({
      where: { tokenHash, revokedAt: IsNull() },
    });
    expect(accessAdminGuard.canActivate).not.toHaveBeenCalled();
  });

  it('rejects expired machine tokens', async () => {
    const { guard } = createGuard({
      tokenHash,
      clientId: 'identity-admin-service',
      scope: 'identity.users.read',
      expiresAt: new Date(Date.now() - 60_000),
    });

    await expect(guard.canActivate(createContext())).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects revoked or unknown opaque tokens', async () => {
    const { guard } = createGuard(null);

    await expect(guard.canActivate(createContext())).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects user tokens', async () => {
    const { guard } = createGuard({
      tokenHash,
      clientId: 'identity-web',
      userId: 'user-id',
      sessionId: 'session-id',
      scope: 'identity.users.read',
      expiresAt: new Date(Date.now() + 60_000),
    });

    await expect(guard.canActivate(createContext())).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects machine tokens without the required scope', async () => {
    const { guard } = createGuard({
      tokenHash,
      clientId: 'identity-admin-service',
      scope: 'identity.oauth_clients.read',
      expiresAt: new Date(Date.now() + 60_000),
    });

    await expect(guard.canActivate(createContext())).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('rejects machine tokens issued to another audience', async () => {
    const { guard } = createGuard(
      {
        tokenHash,
        clientId: 'console-access-admin',
        scope: 'identity.users.read',
        expiresAt: new Date(Date.now() + 60_000),
      },
      { audience: 'access-api' },
    );

    await expect(guard.canActivate(createContext())).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects machine tokens for suspended clients', async () => {
    const { guard } = createGuard(
      {
        tokenHash,
        clientId: 'console-identity-admin',
        scope: 'identity.users.read',
        expiresAt: new Date(Date.now() + 60_000),
      },
      { status: OAuthClientStatus.Suspended },
    );

    await expect(guard.canActivate(createContext())).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
