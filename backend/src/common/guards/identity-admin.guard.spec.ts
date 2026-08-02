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
  } as unknown as Repository<OAuthTokenEntity>;
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
  } as unknown as AccessAdminGuard;
  const guard = new IdentityAdminGuard(
    tokensRepository,
    clientsRepository,
    {
      getAllAndOverride: jest.fn().mockReturnValue('identity.users.read'),
    } as unknown as Reflector,
    accessAdminGuard,
  );

  return { accessAdminGuard, guard, tokensRepository };
};

describe('IdentityAdminGuard', () => {
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

    await expect(guard.canActivate(createContext())).rejects.toThrow(ForbiddenException);
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
