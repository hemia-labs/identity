import { BadRequestException } from '@nestjs/common';
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

const client: OAuthClientEntity = {
  id: 'client-row-id',
  clientId: 'web_app',
  clientSecretHash: null,
  type: OAuthClientType.Public,
  redirectUris: ['https://app.hemia.cloud/callback'],
  grantTypes: ['authorization_code', 'refresh_token'],
  responseTypes: ['code'],
  scopes: ['openid', 'profile', 'email'],
  status: OAuthClientStatus.Active,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const createService = () => {
  const codes: OAuthAuthorizationCodeEntity[] = [];
  const clientsRepository = {
    findOne: jest.fn().mockResolvedValue(client),
  } as unknown as Repository<OAuthClientEntity>;
  const codesRepository = {
    create: jest.fn((input) => input),
    save: jest.fn(async (code) => {
      codes.push(code);
      return code;
    }),
  } as unknown as Repository<OAuthAuthorizationCodeEntity>;
  const tokensRepository = {} as unknown as Repository<OAuthTokenEntity>;
  const consentsService = {
    hasConsent: jest.fn().mockResolvedValue(true),
  } as unknown as ConsentsService;
  const sessionsService = {
    findActive: jest.fn().mockResolvedValue({ id: 'session-id' }),
  } as unknown as SessionsService;

  return {
    service: new OAuthService(
      clientsRepository,
      codesRepository,
      tokensRepository,
      { get: jest.fn() } as unknown as ConfigService,
      consentsService,
      {} as unknown as JwksService,
      {} as unknown as JwtService,
      sessionsService,
      {} as unknown as UsersService,
    ),
    codes,
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
});
