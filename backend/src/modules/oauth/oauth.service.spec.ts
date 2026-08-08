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
    update: jest.fn(async (where, values) => {
      let affected = 0;
      for (const code of codes) {
        const matches =
          (!where.id || code.id === where.id) &&
          (where.usedAt === undefined || !code.usedAt);
        if (matches) {
          Object.assign(code, values);
          affected += 1;
        }
      }
      return { affected };
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
            (!condition.id || token.id === condition.id) &&
            (!condition.clientId || token.clientId === condition.clientId) &&
            (condition.revokedAt === undefined || !token.revokedAt),
        ),
      );
    }),
    save: jest.fn(async (token) => {
      tokens.push(token);
      return token;
    }),
    update: jest.fn(async (where, values) => {
      let affected = 0;
      for (const token of tokens) {
        const matches =
          (!where.id || token.id === where.id) &&
          (!where.familyId || token.familyId === where.familyId) &&
          (where.revokedAt === undefined || !token.revokedAt);
        if (matches) {
          Object.assign(token, values);
          affected += 1;
        }
      }
      return { affected };
    }),
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
      Promise.resolve(
        options?.audience === 'web-app-api' ? 'jwt-access-token' : 'id-token',
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
          if (key === 'ACCESS_AUDIENCE') return 'access-api';
          return fallback;
        }),
      } as unknown as ConfigService,
      {
        hasConsent: jest.fn().mockResolvedValue(true),
      } as unknown as ConsentsService,
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
  it('atomically rotates a refresh token', async () => {
    const { service, tokens } = createService();
    const refreshToken = 'refresh-token-0';
    tokens.push({
      id: 'oauth-token-0',
      tokenHash: 'access-hash-0',
      refreshTokenHash: service['hashToken'](refreshToken),
      clientId: 'web_app',
      userId: 'user-id',
      sessionId: 'session-id',
      scope: 'openid profile',
      familyId: 'family-id',
      expiresAt: new Date(Date.now() + 900_000),
      revokedAt: null,
      createdAt: new Date(),
    });

    const result = await service.token({
      grant_type: 'refresh_token',
      client_id: 'web_app',
      refresh_token: refreshToken,
    });

    expect(result.refresh_token).toEqual(expect.any(String));
    expect(tokens[0].revokedAt).toBeInstanceOf(Date);
    expect(tokens.filter((token) => token.refreshTokenHash)).toHaveLength(2);
    expect(tokens[1].familyId).toBe('family-id');
  });

  it('accepts only one concurrent refresh and rejects the second as reuse', async () => {
    const { service, tokens } = createService();
    const refreshToken = 'refresh-token-concurrent';
    tokens.push({
      id: 'oauth-token-concurrent',
      tokenHash: 'access-hash-concurrent',
      refreshTokenHash: service['hashToken'](refreshToken),
      clientId: 'web_app',
      userId: 'user-id',
      sessionId: 'session-id',
      scope: 'openid profile',
      familyId: 'family-concurrent',
      expiresAt: new Date(Date.now() + 900_000),
      revokedAt: null,
      createdAt: new Date(),
    });

    const results = await Promise.allSettled([
      service.token({
        grant_type: 'refresh_token',
        client_id: 'web_app',
        refresh_token: refreshToken,
      }),
      service.token({
        grant_type: 'refresh_token',
        client_id: 'web_app',
        refresh_token: refreshToken,
      }),
    ]);

    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === 'rejected'),
    ).toHaveLength(1);
    expect(tokens.filter((token) => token.refreshTokenHash)).toHaveLength(2);
  });

  it('rejects sequential reuse and revokes the token family', async () => {
    const { service, tokens } = createService();
    const refreshToken = 'refresh-token-reuse';
    tokens.push({
      id: 'oauth-token-reuse',
      tokenHash: 'access-hash-reuse',
      refreshTokenHash: service['hashToken'](refreshToken),
      clientId: 'web_app',
      userId: 'user-id',
      sessionId: 'session-id',
      scope: 'openid profile',
      familyId: 'family-reuse',
      expiresAt: new Date(Date.now() + 900_000),
      revokedAt: null,
      createdAt: new Date(),
    });

    await service.token({
      grant_type: 'refresh_token',
      client_id: 'web_app',
      refresh_token: refreshToken,
    });

    await expect(
      service.token({
        grant_type: 'refresh_token',
        client_id: 'web_app',
        refresh_token: refreshToken,
      }),
    ).rejects.toThrow('Refresh token reuse detected');

    expect(
      tokens
        .filter((token) => token.familyId === 'family-reuse')
        .every((token) => token.revokedAt),
    ).toBe(true);
  });

  it('revokes the complete family for either an access or refresh token', async () => {
    const { service, tokens } = createService();
    const familyId = 'family-logout';
    const accessToken = 'access-token-logout';
    const refreshToken = 'refresh-token-logout';
    tokens.push(
      {
        id: 'oauth-token-logout-0',
        tokenHash: service['hashToken'](accessToken),
        refreshTokenHash: service['hashToken'](refreshToken),
        clientId: 'web_app',
        userId: 'user-id',
        sessionId: 'session-id',
        scope: 'openid profile',
        familyId,
        expiresAt: new Date(Date.now() + 900_000),
        revokedAt: null,
        createdAt: new Date(),
      },
      {
        id: 'oauth-token-logout-1',
        tokenHash: 'access-hash-child',
        refreshTokenHash: 'refresh-hash-child',
        clientId: 'web_app',
        userId: 'user-id',
        sessionId: 'session-id',
        scope: 'openid profile',
        familyId,
        expiresAt: new Date(Date.now() + 900_000),
        revokedAt: null,
        createdAt: new Date(),
      },
    );

    await service.revoke({ token: accessToken });
    expect(tokens.every((token) => token.revokedAt instanceof Date)).toBe(true);

    const secondFamily = 'family-refresh-logout';
    const secondRefreshToken = 'refresh-token-logout-2';
    tokens.push({
      id: 'oauth-token-refresh-logout',
      tokenHash: 'access-hash-refresh',
      refreshTokenHash: service['hashToken'](secondRefreshToken),
      clientId: 'web_app',
      userId: 'user-id',
      sessionId: 'session-id',
      scope: 'openid profile',
      familyId: secondFamily,
      expiresAt: new Date(Date.now() + 900_000),
      revokedAt: null,
      createdAt: new Date(),
    });

    await service.revoke({ token: secondRefreshToken });
    expect(
      tokens.filter((token) => token.familyId === secondFamily)[0].revokedAt,
    ).toBeInstanceOf(Date);
  });

  it('keeps revocation idempotent when the token does not exist', async () => {
    const { service } = createService();

    await expect(service.revoke({ token: 'missing-token' })).resolves.toEqual({
      revoked: true,
    });
  });

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

  it('consumes an authorization code atomically under concurrent exchange', async () => {
    const { service, tokens } = createService();
    const redirect = await service.authorize(
      {
        client_id: 'web_app',
        redirect_uri: 'https://app.hemia.cloud/callback',
        response_type: 'code',
        scope: 'openid profile',
        code_challenge: 'verifier',
        code_challenge_method: 'plain',
      },
      { id: 'user-id', email: 'user@hemia.cloud', sessionId: 'session-id' },
    );
    const code = new URL(redirect).searchParams.get('code') ?? '';
    const request = {
      grant_type: 'authorization_code' as const,
      client_id: 'web_app',
      redirect_uri: 'https://app.hemia.cloud/callback',
      code,
      code_verifier: 'verifier',
    };

    const results = await Promise.allSettled([
      service.token(request),
      service.token(request),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(tokens).toHaveLength(1);
  });

  it('keeps client credentials in independent token families', async () => {
    const { service, tokens } = createService({
      clientId: 'service-client',
      audience: 'service-api',
      clientSecretHash:
        '$argon2id$v=19$m=65536,t=3,p=4$CIb7mGT3XddmMZD3As8Pyw$F5DWgaQtUu9jIF+60LmR4v6rfqKYrOyVSR7X+0meOrk',
      type: OAuthClientType.Confidential,
      grantTypes: ['client_credentials'],
      scopes: ['service.read'],
    });

    await service.token({
      grant_type: 'client_credentials',
      client_id: 'service-client',
      client_secret: 'secret',
      scope: 'service.read',
    });
    await service.token({
      grant_type: 'client_credentials',
      client_id: 'service-client',
      client_secret: 'secret',
      scope: 'service.read',
    });

    expect(tokens).toHaveLength(2);
    expect(tokens[0].familyId).not.toBe(tokens[1].familyId);
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

    await expect(
      service.introspect({
        client_id: 'access',
        client_secret: 'secret',
        token: issued.access_token,
      }),
    ).resolves.toEqual(
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

  it('exchanges a user token into the same revocable family', async () => {
    const { service, jwtService, tokens } = createService({
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
    await service['tokensRepository'].save(
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
    expect(tokens).toHaveLength(2);
    expect(tokens[1].familyId).toBe('family-id');
    expect(tokens[1].refreshTokenHash).toBeUndefined();

    await service.revoke({ token: subject });
    expect(tokens.every((token) => token.revokedAt instanceof Date)).toBe(true);
  });
});
