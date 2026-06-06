import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { AuthService } from '../auth/auth.service';
import { SessionsService } from '../sessions/sessions.service';
import { SsoClientStatus } from '../sso-clients/entities/sso-client.entity';
import { SsoClientsService } from '../sso-clients/sso-clients.service';
import { UsersService } from '../users/users.service';
import { SsoAuthorizationCodeEntity } from './entities/sso-authorization-code.entity';
import { SsoService } from './sso.service';

const activeClient = {
  clientId: 'hemia_console',
  allowedRedirectUris: ['https://console.hemia.cloud/auth/callback'],
  status: SsoClientStatus.Active,
};

const user = {
  id: 'user-id',
  email: 'user@hemia.cloud',
  username: 'user',
  sessionId: 'session-id',
  tenantId: 'tenant-id',
};

const createService = () => {
  const storedCodes: SsoAuthorizationCodeEntity[] = [];
  const codesRepository = {
    create: jest.fn((input) => input),
    save: jest.fn(async (code) => {
      if (!code.id) {
        code.id = 'code-id';
      }
      storedCodes.push(code);
      return code;
    }),
    findOne: jest.fn(async ({ where }) =>
      storedCodes.find(
        (code) =>
          code.codeHash === where.codeHash &&
          code.clientId === where.clientId &&
          code.redirectUri === where.redirectUri &&
          !code.usedAt,
      ),
    ),
  } as unknown as Repository<SsoAuthorizationCodeEntity>;
  const sessionsService = {
    findActive: jest.fn().mockResolvedValue({ id: 'session-id' }),
  } as unknown as SessionsService;
  const ssoClientsService = {
    findActiveByClientId: jest.fn().mockResolvedValue(activeClient),
  } as unknown as SsoClientsService;
  const usersService = {
    findOne: jest.fn().mockResolvedValue({
      email: 'user@hemia.cloud',
      username: 'user',
      firstName: 'User',
      lastName: 'Hemia',
      avatarUrl: null,
      status: 'active',
    }),
  } as unknown as UsersService;
  const authService = {
    getSession: jest.fn().mockResolvedValue({
      expiresAt: new Date('2030-01-01T00:00:00.000Z'),
    }),
  } as unknown as AuthService;

  return {
    service: new SsoService(
      codesRepository,
      authService,
      sessionsService,
      ssoClientsService,
      usersService,
    ),
    storedCodes,
    ssoClientsService,
  };
};

describe('SsoService', () => {
  it('generates a redirect with code and state for an active client', async () => {
    const { service } = createService();

    const redirect = await service.createAuthorizationRedirect(
      {
        client_id: 'hemia_console',
        redirect_uri: 'https://console.hemia.cloud/auth/callback',
        state: 'state-123',
      },
      user,
    );

    const url = new URL(redirect);
    expect(url.origin + url.pathname).toBe(
      'https://console.hemia.cloud/auth/callback',
    );
    expect(url.searchParams.get('code')).toBeTruthy();
    expect(url.searchParams.get('state')).toBe('state-123');
  });

  it('blocks unregistered redirect URIs', async () => {
    const { service } = createService();

    await expect(
      service.createAuthorizationRedirect(
        {
          client_id: 'hemia_console',
          redirect_uri: 'https://evil.example/callback',
        },
        user,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('fails when the SSO client is not active', async () => {
    const { service, ssoClientsService } = createService();
    jest
      .spyOn(ssoClientsService, 'findActiveByClientId')
      .mockRejectedValue(new UnauthorizedException('SSO client is not active'));

    await expect(
      service.createAuthorizationRedirect(
        {
          client_id: 'hemia_console',
          redirect_uri: 'https://console.hemia.cloud/auth/callback',
        },
        user,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('exchanges a code once and marks it used', async () => {
    const { service, storedCodes } = createService();
    const redirect = await service.createAuthorizationRedirect(
      {
        client_id: 'hemia_console',
        redirect_uri: 'https://console.hemia.cloud/auth/callback',
      },
      user,
    );
    const code = new URL(redirect).searchParams.get('code') ?? '';

    await expect(
      service.exchangeCode({
        clientId: 'hemia_console',
        redirectUri: 'https://console.hemia.cloud/auth/callback',
        code,
      }),
    ).resolves.toMatchObject({
      clientId: 'hemia_console',
      user: {
        email: 'user@hemia.cloud',
      },
      tenantId: 'tenant-id',
      sessionId: 'session-id',
    });
    expect(storedCodes[0].usedAt).toBeInstanceOf(Date);
  });

  it('rejects authorization code reuse', async () => {
    const { service } = createService();
    const redirect = await service.createAuthorizationRedirect(
      {
        client_id: 'hemia_console',
        redirect_uri: 'https://console.hemia.cloud/auth/callback',
      },
      user,
    );
    const code = new URL(redirect).searchParams.get('code') ?? '';
    const dto = {
      clientId: 'hemia_console',
      redirectUri: 'https://console.hemia.cloud/auth/callback',
      code,
    };

    await service.exchangeCode(dto);
    await expect(service.exchangeCode(dto)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects expired authorization codes', async () => {
    const { service, storedCodes } = createService();
    const redirect = await service.createAuthorizationRedirect(
      {
        client_id: 'hemia_console',
        redirect_uri: 'https://console.hemia.cloud/auth/callback',
      },
      user,
    );
    const code = new URL(redirect).searchParams.get('code') ?? '';
    storedCodes[0].expiresAt = new Date(Date.now() - 1000);

    await expect(
      service.exchangeCode({
        clientId: 'hemia_console',
        redirectUri: 'https://console.hemia.cloud/auth/callback',
        code,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
