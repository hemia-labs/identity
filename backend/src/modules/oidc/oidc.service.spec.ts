import { ConfigService } from '@nestjs/config';
import { OAuthService } from '../oauth/oauth.service';
import { OidcService } from './oidc.service';

describe('OidcService', () => {
  it('returns OIDC discovery metadata', () => {
    const service = new OidcService(
      {
        get: jest.fn((_key: string, fallback: string) => fallback),
      } as unknown as ConfigService,
      {} as unknown as OAuthService,
    );

    expect(service.getDiscovery()).toMatchObject({
      issuer: 'https://id.hemia.cloud',
      response_types_supported: ['code'],
      id_token_signing_alg_values_supported: ['RS256'],
    });
  });
});
