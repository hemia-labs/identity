import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
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
});
