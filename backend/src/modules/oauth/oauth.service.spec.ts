import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { ConsentsService } from '../consents/consents.service';
import { JwksService } from '../jwks/jwks.service';
import { RolesService } from '../roles/roles.service';
import { SessionsService } from '../sessions/sessions.service';
import { UsersService } from '../users/users.service';
import { OAuthAuthorizationCodeEntity } from './entities/oauth-authorization-code.entity';
import {
  OAuthClientEntity,
  OAuthClientStatus,
  OAuthClientType,
} from './entities/oauth-client.entity';
import { OAuthTokenEntity } from './entities/oauth-token.entity';
import { OAuthService } from './oauth.service';

const client: OAuthClientEntity = {
  id: 'client-row-id',
  clientId: 'web_app',
  audience: 'web-app-api',
  clientSecretHash: null,
  type: OAuthClientType.Public,
  redirectUris: ['https://app.hemia.cloud/callback'],
  grantTypes: ['authorization_code', 'refresh_token'],
  responseTypes: ['code'],
  scopes: ['openid', 'profile', 'email'],
  requiresConsent: true,
  status: OAuthClientStatus.Active,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const createService = (clientOverride: Partial<OAuthClientEntity> = {}) => {
  const activeClient = { ...client, ...clientOverride };
  const codes: OAuthAuthorizationCodeEntity[] = [];
  const tokens: OAuthTokenEntity[] = [];
  const clientsRepository = {
    findOne: jest.fn().mockResolvedValue(activeClient),
  } as unknown as Repository<OAuthClientEntity>;
  const codesRepository = {
    create: jest.fn((input) => input),
    findOne: jest.fn(async ({ where }) =>
      codes.find(
        (code) =>
          code.codeHash === where.codeHash &&
          code.clientId === where.clientId &&
          code.redirectUri === where.redirectUri &&
          !code.usedAt,
      ),
    ),
    save: jest.fn(async (code) => {
      if (!codes.includes(code)) {
        codes.push(code);
      }
      return code;
    }),
  } as unknown as Repository<OAuthAuthorizationCodeEntity>;
  const tokensRepository = {
    create: jest.fn((input) => input),
    findOne: jest.fn(async ({ where }) => {
      const conditions = Array.isArray(where) ? where : [where];
      return tokens.find((token) =>
        conditions.some(
          (condition) =>
            (!condition.tokenHash || token.tokenHash === condition.tokenHash) &&
            (!condition.refreshTokenHash ||
              token.refreshTokenHash === condition.refreshTokenHash) &&
            (!condition.clientId || token.clientId === condition.clientId) &&
            (condition.revokedAt === undefined || !token.revokedAt),
        ),
      );
    }),
    save: jest.fn(async (token) => {
      tokens.push(token);
      return token;
    }),
    update: jest.fn(),
  } as unknown as Repository<OAuthTokenEntity>;
  const consentsService = {
    hasConsent: jest.fn().mockResolvedValue(true),
  };
  const sessionsService = {
    findActive: jest.fn().mockResolvedValue({
      id: 'session-id',
      tenantId: 'tenant-id',
      organizationId: 'organization-id',
      teamId: 'team-id',
    }),
  };
  const usersService = {
    findOne: jest.fn().mockResolvedValue({
      id: 'user-id',
      email: 'user@hemia.cloud',
      username: 'user',
      firstName: 'Hemia',
      lastName: 'User',
      avatarUrl: 'https://cdn.hemia.cloud/user.png',
    }),
  };
  const rolesService = {
    getEffectiveRoleCodes: jest.fn().mockResolvedValue(['DOCS_ADMIN']),
    getEffectivePermissionCodes: jest
      .fn()
      .mockResolvedValue(['docs.access', 'docs.*']),
  };
  const jwksService = {
    getActiveKey: jest.fn().mockResolvedValue({
      kid: 'kid-1',
      privateKey: 'private-key',
      publicKey: 'public-key',
      alg: 'RS256',
    }),
  };
  const jwtService = {
    signAsync: jest.fn((_payload, options) =>
      Promise.resolve(
        options?.audience === 'hemia-docs-api'
          ? 'jwt-access-token'
          : 'id-token',
      ),
    ),
  };

  return {
    service: new OAuthService(
      clientsRepository,
      codesRepository,
      tokensRepository,
      {
        get: jest.fn((key, fallback) => {
          if (key === 'app.issuer') return 'http://localhost:3000';
          return fallback;
        }),
      } as unknown as ConfigService,
      consentsService as unknown as ConsentsService,
      jwksService as unknown as JwksService,
      jwtService as unknown as JwtService,
      rolesService as unknown as RolesService,
      sessionsService as unknown as SessionsService,
      usersService as unknown as UsersService,
    ),
    codes,
    consentsService,
    jwtService,
    rolesService,
    tokens,
  };
};

describe('OAuthService', () => {
  it('rejects invalid redirect URIs', async () => {
    const { service } = createService();

    await expect(
      service.authorize(
        {
          client_id: 'web_app',
          redirect_uri: 'https://evil.example/callback',
          response_type: 'code',
          scope: 'openid',
          code_challenge: 'challenge',
          code_challenge_method: 'S256',
        },
        {
          id: 'user-id',
          email: 'user@hemia.cloud',
          sessionId: 'session-id',
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates an authorization code redirect with state', async () => {
    const { service, codes } = createService();

    const redirect = await service.authorize(
      {
        client_id: 'web_app',
        redirect_uri: 'https://app.hemia.cloud/callback',
        response_type: 'code',
        scope: 'openid profile',
        code_challenge: 'challenge',
        code_challenge_method: 'plain',
        state: 'state-1',
      },
      {
        id: 'user-id',
        email: 'user@hemia.cloud',
        sessionId: 'session-id',
      },
    );

    const url = new URL(redirect);
    expect(url.searchParams.get('code')).toBeTruthy();
    expect(url.searchParams.get('state')).toBe('state-1');
    expect(codes[0].codeHash).toHaveLength(64);
  });

  it('skips consent for first-party clients', async () => {
    const { service, consentsService } = createService({
      clientId: 'hemia-docs',
      audience: 'hemia-docs-api',
      scopes: ['openid', 'profile', 'email', 'docs.access'],
      requiresConsent: false,
    });

    await service.authorize(
      {
        client_id: 'hemia-docs',
        redirect_uri: 'https://app.hemia.cloud/callback',
        response_type: 'code',
        scope: 'openid docs.access',
        code_challenge: 'challenge',
        code_challenge_method: 'plain',
      },
      {
        id: 'user-id',
        email: 'user@hemia.cloud',
        sessionId: 'session-id',
      },
    );

    expect(consentsService.hasConsent).not.toHaveBeenCalled();
  });

  it('issues an RS256 JWT access token with Docs claims', async () => {
    const { service, jwtService, tokens } = createService({
      clientId: 'hemia-docs',
      audience: 'hemia-docs-api',
      scopes: ['openid', 'profile', 'email', 'docs.access', 'docs.*'],
      requiresConsent: false,
    });

    const redirect = await service.authorize(
      {
        client_id: 'hemia-docs',
        redirect_uri: 'https://app.hemia.cloud/callback',
        response_type: 'code',
        scope: 'openid docs.access docs.*',
        code_challenge: 'verifier',
        code_challenge_method: 'plain',
        nonce: 'nonce-1',
      },
      {
        id: 'user-id',
        email: 'user@hemia.cloud',
        sessionId: 'session-id',
      },
    );
    const code = new URL(redirect).searchParams.get('code') ?? '';

    const result = await service.token({
      grant_type: 'authorization_code',
      client_id: 'hemia-docs',
      redirect_uri: 'https://app.hemia.cloud/callback',
      code,
      code_verifier: 'verifier',
    });

    expect(result.access_token).toBe('jwt-access-token');
    expect(result.id_token).toBe('id-token');
    expect(tokens[0].tokenHash).toHaveLength(64);
    expect(jwtService.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'user@hemia.cloud',
        tenant_id: 'tenant-id',
        session_id: 'session-id',
        roles: ['DOCS_ADMIN'],
        permissions: ['docs.access', 'docs.*'],
      }),
      expect.objectContaining({
        algorithm: 'RS256',
        audience: 'hemia-docs-api',
        issuer: 'http://localhost:3000',
        jwtid: expect.any(String),
        keyid: 'kid-1',
        subject: 'user-id',
      }),
    );
  });

  it('introspects JWT access tokens with Docs claims', async () => {
    const { service } = createService({
      clientId: 'hemia-docs',
      audience: 'hemia-docs-api',
      scopes: ['openid', 'profile', 'email', 'docs.access'],
      requiresConsent: false,
    });

    const redirect = await service.authorize(
      {
        client_id: 'hemia-docs',
        redirect_uri: 'https://app.hemia.cloud/callback',
        response_type: 'code',
        scope: 'openid docs.access',
        code_challenge: 'verifier',
        code_challenge_method: 'plain',
      },
      {
        id: 'user-id',
        email: 'user@hemia.cloud',
        sessionId: 'session-id',
      },
    );
    const code = new URL(redirect).searchParams.get('code') ?? '';
    await service.token({
      grant_type: 'authorization_code',
      client_id: 'hemia-docs',
      redirect_uri: 'https://app.hemia.cloud/callback',
      code,
      code_verifier: 'verifier',
    });

    await expect(
      service.introspect({ token: 'jwt-access-token' }),
    ).resolves.toMatchObject({
      active: true,
      client_id: 'hemia-docs',
      sub: 'user-id',
      tenant_id: 'tenant-id',
      roles: ['DOCS_ADMIN'],
      permissions: ['docs.access', 'docs.*'],
    });
  });
});
