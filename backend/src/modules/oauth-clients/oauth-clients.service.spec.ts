import { BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import {
  OAuthClientEntity,
  OAuthClientStatus,
  OAuthClientType,
} from '../oauth/entities/oauth-client.entity';
import { OAuthClientsService } from './oauth-clients.service';

const client: OAuthClientEntity = {
  id: 'client-id',
  clientId: 'console',
  audience: 'console-api',
  clientSecretHash: 'hash',
  type: OAuthClientType.Confidential,
  redirectUris: ['https://console.hemia.cloud/callback'],
  grantTypes: ['authorization_code'],
  responseTypes: ['code'],
  scopes: ['openid'],
  requiresConsent: true,
  status: OAuthClientStatus.Active,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const createService = () => {
  const row = { ...client };
  const repository = {
    findOne: jest.fn().mockResolvedValue(row),
    save: jest.fn(async (value) => value),
  } as unknown as Repository<OAuthClientEntity>;

  return {
    repository,
    service: new OAuthClientsService(repository),
  };
};

describe('OAuthClientsService', () => {
  it('adds values once and never exposes clientSecretHash', async () => {
    const { service } = createService();

    const updated = await service.addScope('client-id', 'openid');

    expect(updated.scopes).toEqual(['openid']);
    expect('clientSecretHash' in updated).toBe(false);
  });

  it('removes missing values without failing', async () => {
    const { service } = createService();

    const updated = await service.removeGrantType(
      'client-id',
      'client_credentials',
    );

    expect(updated.grantTypes).toEqual(['authorization_code']);
  });

  it('rejects redirect uris without protocol', async () => {
    const { service } = createService();

    expect(() =>
      service.addRedirectUri('client-id', 'console.hemia.cloud/callback'),
    ).toThrow(BadRequestException);
  });
});
