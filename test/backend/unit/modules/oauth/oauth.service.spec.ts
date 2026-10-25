import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { generateKeyPairSync } from 'crypto';
import { ConsentsService } from '../../../../../backend/src/modules/consents/consents.service';
import { JwksService } from '../../../../../backend/src/modules/jwks/jwks.service';
import { SessionsService } from '../../../../../backend/src/modules/sessions/sessions.service';
import { UsersService } from '../../../../../backend/src/modules/users/users.service';
import { OAuthAuthorizationCodeEntity } from '../../../../../backend/src/modules/oauth/entities/oauth-authorization-code.entity';
import {
  OAuthClientEntity,
  OAuthClientStatus,
  OAuthClientType,
} from '../../../../../backend/src/modules/oauth/entities/oauth-client.entity';
import { OAuthTokenEntity } from '../../../../../backend/src/modules/oauth/entities/oauth-token.entity';
import { OAuthService } from '../../../../../backend/src/modules/oauth/oauth.service';

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
    create: jest.fn((input: OAuthAuthorizationCodeEntity) => input),
    findOne: jest.fn(
      ({ where }: { where: Partial<OAuthAuthorizationCodeEntity> }) =>
        Promise.resolve(
          codes.find(
            (code) =>
              code.codeHash === where.codeHash &&
              code.clientId === where.clientId &&
              code.redirectUri === where.redirectUri &&
              !code.usedAt,
          ),
        ),
    ),
    save: jest.fn((code: OAuthAuthorizationCodeEntity) => {
      if (!codes.includes(code)) codes.push(code);
      return Promise.resolve(code);
    }),
    update: jest.fn(
      (
        where: Partial<OAuthAuthorizationCodeEntity>,
        values: Partial<OAuthAuthorizationCodeEntity>,
      ) => {
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
        return Promise.resolve({ affected });
      },
    ),
  } as unknown as Repository<OAuthAuthorizationCodeEntity>;
  const tokensRepository = {
    create: jest.fn((input: OAuthTokenEntity) => input),
    findOne: jest.fn(
      ({
        where,
      }: {
        where: Partial<OAuthTokenEntity> | Partial<OAuthTokenEntity>[];
      }) => {
        const conditions = Array.isArray(where) ? where : [where];
        return Promise.resolve(
          tokens.find((token) =>
            conditions.some(
              (condition) =>
                (!condition.tokenHash ||
                  token.tokenHash === condition.tokenHash) &&
                (!condition.refreshTokenHash ||
                  token.refreshTokenHash === condition.refreshTokenHash) &&
                (!condition.id || token.id === condition.id) &&
                (!condition.clientId ||
                  token.clientId === condition.clientId) &&
                (condition.revokedAt === undefined || !token.revokedAt),
            ),
          ),
        );
      },
    ),
    save: jest.fn((token: OAuthTokenEntity) => {
      tokens.push(token);
      return Promise.resolve(token);
    }),
    update: jest.fn(
      (where: Partial<OAuthTokenEntity>, values: Partial<OAuthTokenEntity>) => {
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
        return Promise.resolve({ affected });
      },
    ),
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
    signAsync: jest.fn((_payload: unknown, options?: JwtSignOptions) =>
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
        get: jest.fn((key: string, fallback: unknown) => {
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
    jwksService,
    jwtService,
    tokens,
  };
};

describe('OAuthService', () => {
  describe('service destinations', () => {
    const setup = () =>
      createService({
        clientId: 'legal-service-dev',
        audience: 'legal-api',
        type: OAuthClientType.Confidential,
        grantTypes: ['client_credentials'],
        clientSecretHash:
          '$argon2id$v=19$m=65536,t=3,p=4$CIb7mGT3XddmMZD3As8Pyw$F5DWgaQtUu9jIF+60LmR4v6rfqKYrOyVSR7X+0meOrk',
        scopes: ['unrelated.login.scope'],
        serviceDestinations: [
          {
            resource: 'https://identity.test',
            audience: 'identity-api',
            scopes: [
              'identity.tokens.introspect',
              'identity.oauth_clients.read',
            ],
          },
          {
            resource: 'https://access.test',
            audience: 'access-api',
            scopes: ['legal.consumer_context.read'],
          },
        ],
      });
    const request = {
      grant_type: 'client_credentials',
      client_id: 'legal-service-dev',
      client_secret: 'secret',
    };
    it.each([
      { scope: 'identity.oauth_clients.read' },
      {
        resource: 'https://unknown.test',
        scope: 'identity.oauth_clients.read',
      },
      { resource: 'https://access.test', scope: 'identity.oauth_clients.read' },
      {
        resource: 'https://identity.test',
        scope: 'identity.oauth_clients.read legal.consumer_context.read',
      },
      {
        resource: 'https://identity.test',
        audience: 'access-api',
        scope: 'identity.oauth_clients.read',
      },
      { resource: 'https://identity.test' },
    ])('rejects invalid destination/scope combinations %j', async (input) => {
      const { service, tokens, jwtService } = setup();
      await expect(service.token({ ...request, ...input })).rejects.toThrow(
        BadRequestException,
      );
      expect(tokens).toHaveLength(0);
      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });
    it.each([
      ['https://identity.test', 'identity-api', 'identity.oauth_clients.read'],
      ['https://access.test', 'access-api', 'legal.consumer_context.read'],
    ])(
      'issues only requested scopes and persists the audience for %s',
      async (resource, audience, scope) => {
        const { service, tokens, jwtService } = setup();
        const issued = await service.token({
          ...request,
          resource,
          scope: `${scope} ${scope}`,
        });
        expect(issued.scope).toBe(scope);
        expect(jwtService.signAsync).toHaveBeenCalledWith(
          expect.objectContaining({ scope }),
          expect.objectContaining({ audience }),
        );
        expect(tokens[0].audience).toBe(audience);
        await expect(
          service.introspect({
            client_id: request.client_id,
            client_secret: request.client_secret,
            token: issued.access_token as string,
          }),
        ).resolves.toMatchObject({ active: true, aud: audience, scope });
      },
    );
    it('supports an explicitly allowed audience selector', async () => {
      const { service, tokens } = setup();
      await service.token({
        ...request,
        audience: 'access-api',
        scope: 'legal.consumer_context.read',
      });
      expect(tokens[0].audience).toBe('access-api');
    });
    it.each([undefined, 'https://identity.test'])(
      'does not issue a token from top-level scopes when destinations are empty (%s)',
      async (resource) => {
        const { service, tokens, jwtService } = createService({
          type: OAuthClientType.Confidential,
          grantTypes: ['client_credentials'],
          serviceDestinations: [],
          scopes: ['openid'],
          clientSecretHash:
            '$argon2id$v=19$m=65536,t=3,p=4$CIb7mGT3XddmMZD3As8Pyw$F5DWgaQtUu9jIF+60LmR4v6rfqKYrOyVSR7X+0meOrk',
        });
        await expect(
          service.token({ ...request, resource, scope: 'openid' }),
        ).rejects.toThrow(BadRequestException);
        expect(tokens).toHaveLength(0);
        expect(jwtService.signAsync).not.toHaveBeenCalled();
      },
    );
    it('rejects a different audience for a single-destination client', async () => {
      const { service } = createService({
        type: OAuthClientType.Confidential,
        grantTypes: ['client_credentials'],
        clientSecretHash:
          '$argon2id$v=19$m=65536,t=3,p=4$CIb7mGT3XddmMZD3As8Pyw$F5DWgaQtUu9jIF+60LmR4v6rfqKYrOyVSR7X+0meOrk',
      });
      await expect(
        service.token({ ...request, audience: 'other-api', scope: 'openid' }),
      ).rejects.toThrow('destination is not allowed');
    });
  });

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

    expect(result).toHaveProperty('refresh_token', expect.any(String));
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
    expect(result).toHaveProperty('id_token', 'id-token');
    expect(tokens[0].tokenHash).toHaveLength(64);
    expect(jwtService.signAsync).toHaveBeenCalledWith(
      expect.not.objectContaining({
        [OLD_TENANT]: expect.anything() as unknown,
        [OLD_ORG]: expect.anything() as unknown,
        [OLD_ROLES]: expect.anything() as unknown,
        [OLD_PERMISSIONS]: expect.anything() as unknown,
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

    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === 'rejected'),
    ).toHaveLength(1);
    expect(tokens).toHaveLength(1);
  });

  it('issues signed service access tokens without a user session and supports revocation', async () => {
    const { service, tokens, jwksService, jwtService } = createService({
      clientId: 'billing-service',
      audience: 'billing-api',
      clientSecretHash:
        '$argon2id$v=19$m=65536,t=3,p=4$CIb7mGT3XddmMZD3As8Pyw$F5DWgaQtUu9jIF+60LmR4v6rfqKYrOyVSR7X+0meOrk',
      type: OAuthClientType.Confidential,
      grantTypes: ['client_credentials'],
      scopes: [
        'billing.integration.checkout.create',
        'identity.tokens.introspect',
      ],
    });
    const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const signingKey = {
      kid: 'service-key',
      alg: 'RS256',
      privateKey: keys.privateKey
        .export({ type: 'pkcs8', format: 'pem' })
        .toString(),
      publicKey: keys.publicKey
        .export({ type: 'spki', format: 'pem' })
        .toString(),
    };
    jwksService.getActiveKey.mockResolvedValue(signingKey);
    const jwt = new JwtService();
    jwtService.signAsync.mockImplementation(
      (payload: object, options?: JwtSignOptions) =>
        jwt.signAsync(payload, options),
    );
    const request = {
      grant_type: 'client_credentials' as const,
      client_id: 'billing-service',
      client_secret: 'secret',
      scope: 'billing.integration.checkout.create',
    };
    const issued = await service.token(request);
    const second = await service.token(request);
    const claims = await jwt.verifyAsync<{
      exp: number;
      iat: number;
      jti: string;
    }>(issued.access_token as string, {
      algorithms: ['RS256'],
      audience: 'billing-api',
      issuer: 'http://localhost:3000',
      publicKey: signingKey.publicKey,
    });
    expect(
      jwt.decode(issued.access_token as string, { complete: true }),
    ).toMatchObject({
      header: { alg: 'RS256', typ: 'at+jwt', kid: 'service-key' },
    });
    expect(claims).toMatchObject({
      sub: 'billing-service',
      client_id: 'billing-service',
      grant_type: 'client_credentials',
      scope: request.scope,
    });
    expect(claims.iat).toEqual(expect.any(Number));
    expect(claims.exp).toEqual(expect.any(Number));
    expect(claims.jti).toEqual(expect.any(String));
    expect(claims.exp - claims.iat).toBe(600);
    expect(claims).not.toHaveProperty('email');
    expect(claims).not.toHaveProperty('session_id');
    expect(claims).not.toHaveProperty(OLD_ORG);
    expect(issued.expires_in).toBe(600);
    expect(issued.access_token).not.toBe(second.access_token);
    expect(tokens[0].tokenHash).toBe(
      service['hashToken'](issued.access_token as string),
    );
    expect(
      Math.abs(tokens[0].expiresAt.getTime() / 1000 - claims.exp),
    ).toBeLessThanOrEqual(1);
    expect(tokens[0].userId).toBeUndefined();
    expect(tokens[0].sessionId).toBeUndefined();
    const introspection = {
      client_id: 'billing-service',
      client_secret: 'secret',
      token: issued.access_token as string,
    };
    await expect(service.introspect(introspection)).resolves.toMatchObject({
      active: true,
      aud: 'billing-api',
      client_id: 'billing-service',
      scope: request.scope,
    });
    await service.revoke({ token: issued.access_token as string });
    await expect(service.introspect(introspection)).resolves.toEqual({
      active: false,
    });
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
        token: issued.access_token as string,
      }),
    ).resolves.toEqual(
      expect.not.objectContaining({
        [OLD_TENANT]: expect.anything() as unknown,
        [OLD_ORG]: expect.anything() as unknown,
        [OLD_ROLES]: expect.anything() as unknown,
        [OLD_PERMISSIONS]: expect.anything() as unknown,
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
