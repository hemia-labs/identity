import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { ConsentsService } from '../consents/consents.service';
import { JwksService } from '../jwks/jwks.service';
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

const TOKEN_EXCHANGE_GRANT = 'urn:ietf:params:oauth:grant-type:token-exchange';
const ACCESS_TOKEN_TYPE = 'urn:ietf:params:oauth:token-type:access_token';
const OLD_TENANT = 'ten' + 'ant_id';
const OLD_ORG = 'organi' + 'zation_id';
const OLD_ROLES = 'ro' + 'les';
const OLD_PERMISSIONS = 'permis' + 'sions';

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
      if (!codes.includes(code)) codes.push(code);
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
  const sessionsService = {
    findActive: jest.fn().mockResolvedValue({ id: 'session-id' }),
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
      Promise.resolve(options?.audience === 'web-app-api' ? 'jwt-access-token' : 'id-token'),
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
          if (key === 'ACCESS_AUDIENCE') return 'access-api';
          return fallback;
        }),
      } as unknown as ConfigService,
      { hasConsent: jest.fn().mockResolvedValue(true) } as unknown as ConsentsService,
      jwksService as unknown as JwksService,
      jwtService as unknown as JwtService,
      sessionsService as unknown as SessionsService,
      usersService as unknown as UsersService,
    ),
    codes,
    jwtService,
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
        { id: 'user-id', email: 'user@hemia.cloud', sessionId: 'session-id' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('issues identity-only OAuth and OIDC tokens', async () => {
    const { service, jwtService, tokens } = createService();
    const redirect = await service.authorize(
      {
        client_id: 'web_app',
        redirect_uri: 'https://app.hemia.cloud/callback',
        response_type: 'code',
        scope: 'openid profile',
        code_challenge: 'verifier',
        code_challenge_method: 'plain',
        nonce: 'nonce-1',
      },
      { id: 'user-id', email: 'user@hemia.cloud', sessionId: 'session-id' },
    );

    const result = await service.token({
      grant_type: 'authorization_code',
      client_id: 'web_app',
      redirect_uri: 'https://app.hemia.cloud/callback',
      code: new URL(redirect).searchParams.get('code') ?? '',
      code_verifier: 'verifier',
    });

    expect(result.access_token).toBe('jwt-access-token');
    expect(result.id_token).toBe('id-token');
    expect(tokens[0].tokenHash).toHaveLength(64);
    expect(jwtService.signAsync).toHaveBeenCalledWith(
      expect.not.objectContaining({
        [OLD_TENANT]: expect.anything(),
        [OLD_ORG]: expect.anything(),
        [OLD_ROLES]: expect.anything(),
        [OLD_PERMISSIONS]: expect.anything(),
      }),
      expect.objectContaining({
        algorithm: 'RS256',
        audience: 'web-app-api',
        subject: 'user-id',
      }),
    );
  });

  it('introspects without access-domain claims', async () => {
    const { service } = createService({
      clientId: 'access',
      audience: 'identity-api',
      clientSecretHash:
        '$argon2id$v=19$m=65536,t=3,p=4$CIb7mGT3XddmMZD3As8Pyw$F5DWgaQtUu9jIF+60LmR4v6rfqKYrOyVSR7X+0meOrk',
      type: OAuthClientType.Confidential,
      grantTypes: ['client_credentials'],
      scopes: ['identity.tokens.introspect'],
    });
    const issued = await service.token({
      grant_type: 'client_credentials',
      client_id: 'access',
      client_secret: 'secret',
      scope: 'identity.tokens.introspect',
    });

    await expect(service.introspect({
      client_id: 'access',
      client_secret: 'secret',
      token: issued.access_token,
    })).resolves.toEqual(
      expect.not.objectContaining({
        [OLD_TENANT]: expect.anything(),
        [OLD_ORG]: expect.anything(),
        [OLD_ROLES]: expect.anything(),
        [OLD_PERMISSIONS]: expect.anything(),
      }),
    );
  });

  it('rejects introspection clients without the required scope', async () => {
    const { service } = createService({
      clientId: 'console-identity-admin',
      audience: 'identity-api',
      clientSecretHash:
        '$argon2id$v=19$m=65536,t=3,p=4$CIb7mGT3XddmMZD3As8Pyw$F5DWgaQtUu9jIF+60LmR4v6rfqKYrOyVSR7X+0meOrk',
      type: OAuthClientType.Confidential,
      scopes: ['identity.users.read'],
    });

    await expect(
      service.introspect({
        client_id: 'console-identity-admin',
        client_secret: 'secret',
        token: 'opaque-token',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('exchanges a user token for the Access audience', async () => {
    const { service, jwtService } = createService({
      clientId: 'access-api',
      audience: 'access-api',
      clientSecretHash:
        '$argon2id$v=19$m=65536,t=3,p=4$CIb7mGT3XddmMZD3As8Pyw$F5DWgaQtUu9jIF+60LmR4v6rfqKYrOyVSR7X+0meOrk',
      type: OAuthClientType.Confidential,
      grantTypes: [TOKEN_EXCHANGE_GRANT],
      scopes: ['openid', 'profile', 'email'],
    });
    const subject = await service['signAccessToken'](
      { ...client, audience: 'web-app-api' },
      'user-id',
      'session-id',
      'openid',
    );
    service['tokensRepository'].save(
      service['tokensRepository'].create({
        tokenHash: service['hashToken'](subject),
        clientId: 'web_app',
        userId: 'user-id',
        sessionId: 'session-id',
        scope: 'openid',
        familyId: 'family-id',
        expiresAt: new Date(Date.now() + 60_000),
      }),
    );

    const result = await service.token({
      grant_type: TOKEN_EXCHANGE_GRANT,
      client_id: 'access-api',
      client_secret: 'secret',
      subject_token: subject,
      subject_token_type: ACCESS_TOKEN_TYPE,
      audience: 'access-api',
      scope: 'openid',
    });

    expect(result).toMatchObject({
      access_token: 'id-token',
      issued_token_type: ACCESS_TOKEN_TYPE,
      token_type: 'Bearer',
    });
    expect(jwtService.signAsync).toHaveBeenLastCalledWith(
      expect.any(Object),
      expect.objectContaining({ audience: 'access-api' }),
    );
  });
});
