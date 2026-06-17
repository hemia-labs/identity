import { BadRequestException } from '@nestjs/common';
import { ConsentsService } from './consents.service';
import {
  OAuthClientStatus,
  OAuthClientType,
} from '../oauth/entities/oauth-client.entity';

const client = {
  clientId: 'console',
  type: OAuthClientType.Public,
  redirectUris: ['http://localhost:5173/auth/callback'],
  grantTypes: ['authorization_code'],
  responseTypes: ['code'],
  scopes: ['openid', 'profile', 'email'],
  status: OAuthClientStatus.Active,
};

describe('ConsentsService', () => {
  const createService = () => {
    const consentsRepository = {
      findOne: jest.fn(),
      create: jest.fn((value) => value),
      save: jest.fn((value) => Promise.resolve(value)),
    };
    const clientsRepository = {
      findOne: jest.fn(() => Promise.resolve(client)),
    };

    return {
      service: new ConsentsService(
        consentsRepository as never,
        clientsRepository as never,
      ),
      consentsRepository,
      clientsRepository,
    };
  };

  const returnTo =
    '/oauth/authorize?client_id=console&redirect_uri=http%3A%2F%2Flocalhost%3A5173%2Fauth%2Fcallback&response_type=code&scope=openid%20profile&code_challenge=abc&code_challenge_method=S256&state=xyz';

  it('returns a validated OAuth consent request', async () => {
    const { service } = createService();

    await expect(service.getOAuthRequest('user-id', returnTo)).resolves.toMatchObject({
      clientId: 'console',
      clientName: 'console',
      redirectUri: 'http://localhost:5173/auth/callback',
      state: 'xyz',
      approved: false,
      scopes: [
        { key: 'openid', label: 'Openid' },
        { key: 'profile', label: 'Profile' },
      ],
    });
  });

  it('grants consent and returns the authorize URL', async () => {
    const { service, consentsRepository } = createService();
    consentsRepository.findOne.mockResolvedValue(null);

    await expect(
      service.approveOAuthConsent('user-id', returnTo),
    ).resolves.toEqual({
      approved: true,
      authorizeUrl: returnTo,
    });
    expect(consentsRepository.save).toHaveBeenCalledWith({
      userId: 'user-id',
      clientId: 'console',
      scopes: ['openid', 'profile'],
    });
  });

  it('rejects disallowed redirect URIs', async () => {
    const { service } = createService();

    await expect(
      service.getOAuthRequest(
        'user-id',
        '/oauth/authorize?client_id=console&redirect_uri=http%3A%2F%2Fevil.test%2Fcallback&scope=openid',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects disallowed scopes', async () => {
    const { service } = createService();

    await expect(
      service.getOAuthRequest(
        'user-id',
        '/oauth/authorize?client_id=console&redirect_uri=http%3A%2F%2Flocalhost%3A5173%2Fauth%2Fcallback&scope=admin',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
