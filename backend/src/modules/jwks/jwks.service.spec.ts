import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { generateKeyPairSync } from 'crypto';
import { JwksKeyEntity } from './entities/jwks-key.entity';
import { JwksService } from './jwks.service';

describe('JwksService', () => {
  const createConfigService = (env: string) =>
    ({
      get: jest.fn((key: string) => (key === 'app.env' ? env : undefined)),
    }) as unknown as ConfigService;

  it('publishes an active public JWKS without private key material', async () => {
    const service = new JwksService(
      {
        findOne: jest.fn().mockResolvedValue(null),
      } as unknown as Repository<JwksKeyEntity>,
      createConfigService('development'),
    );

    const jwks = await service.getPublicJwks();

    expect(jwks.keys[0]).toMatchObject({
      kty: 'RSA',
      kid: 'dev-fallback-rs256',
      alg: 'RS256',
      use: 'sig',
    });
    expect(jwks.keys[0]).not.toHaveProperty('d');
  });

  it('requires a persisted active key in production', async () => {
    const service = new JwksService(
      {
        findOne: jest.fn().mockResolvedValue(null),
      } as unknown as Repository<JwksKeyEntity>,
      createConfigService('production'),
    );

    await expect(service.getActiveKey()).rejects.toThrow(
      'Active JWKS key is required in production',
    );
  });

  it('publishes the public key derived from the active private key', async () => {
    const { privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    const staleKeyPair = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    const service = new JwksService(
      {
        findOne: jest.fn().mockResolvedValue({
          kid: 'local-dev-rs256',
          alg: 'RS256',
          publicKey: staleKeyPair.publicKey,
          privateKeyEncrypted: privateKey,
        }),
      } as unknown as Repository<JwksKeyEntity>,
      createConfigService('development'),
    );

    const activeKey = await service.getActiveKey();
    const jwks = await service.getPublicJwks();

    expect(activeKey.publicKey).not.toBe(staleKeyPair.publicKey);
    expect(jwks.keys[0]).toMatchObject({
      kid: 'local-dev-rs256',
      alg: 'RS256',
      use: 'sig',
    });
  });
});
