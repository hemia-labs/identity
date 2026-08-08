import { createRemoteJWKSet, jwtVerify } from 'jose';
import { ConfigError, UnauthorizedError } from './errors';
import type { SsoConfig } from './config';
import type { AccessContext, TokenResponse } from './types';

const TOKEN_EXCHANGE_GRANT = 'urn:ietf:params:oauth:grant-type:token-exchange';
const ACCESS_TOKEN_TYPE = 'urn:ietf:params:oauth:token-type:access_token';

export class AccessClient {
  constructor(private readonly cfg: SsoConfig) {}

  async exchangeUserToken(userAccessToken: string, scope = this.cfg.scope) {
    const access = this.requireAccessConfig();
    if (!this.cfg.clientSecret) {
      throw new ConfigError('clientSecret is required for token exchange');
    }

    const res = await fetch(this.cfg.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: TOKEN_EXCHANGE_GRANT,
        client_id: this.cfg.clientId,
        client_secret: this.cfg.clientSecret,
        subject_token: userAccessToken,
        subject_token_type: ACCESS_TOKEN_TYPE,
        audience: access.audience,
        scope,
      }),
    });
    if (!res.ok) throw new UnauthorizedError('Access token exchange failed');
    const tokens = (await res.json()) as TokenResponse;
    if (!tokens.access_token) throw new UnauthorizedError('Invalid token response');
    return tokens.access_token;
  }

  async getContext(
    accessToken: string,
    productCode = this.cfg.productCode,
  ): Promise<AccessContext> {
    const access = this.requireAccessConfig();
    const url = new URL('/v1/me/context', access.apiBaseUrl);
    if (productCode) url.searchParams.set('product', productCode);
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new UnauthorizedError('Access context failed');
    return res.json() as Promise<AccessContext>;
  }

  async resolveContext(
    accessToken: string,
    input: { organization_id: string; audience?: string; product_code?: string },
  ) {
    const access = this.requireAccessConfig();
    const res = await fetch(new URL('/v1/me/context/resolve', access.apiBaseUrl), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new UnauthorizedError('Access context resolve failed');
    return res.json() as Promise<{ context_token: string } & Record<string, unknown>>;
  }

  async verifyContextToken(token: string) {
    const access = this.requireAccessConfig();
    const jwks = createRemoteJWKSet(new URL(access.jwksUrl));
    try {
      const { payload } = await jwtVerify(token, jwks, {
        audience: access.audience,
      });
      return payload;
    } catch {
      throw new UnauthorizedError('Context token signature does not match JWKS');
    }
  }

  private requireAccessConfig() {
    if (!this.cfg.access) throw new ConfigError('access config not configured');
    return this.cfg.access;
  }
}
