import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuthService } from '../oauth/oauth.service';

@Injectable()
export class OidcService {
  constructor(
    private readonly configService: ConfigService,
    private readonly oauthService: OAuthService,
  ) {}

  getDiscovery() {
    const issuer = this.configService.get<string>(
      'app.issuer',
      'https://id.hemia.cloud',
    );
    return {
      issuer,
      authorization_endpoint: `${issuer}/oauth/authorize`,
      token_endpoint: `${issuer}/oauth/token`,
      revocation_endpoint: `${issuer}/oauth/revoke`,
      end_session_endpoint: `${issuer}/oauth/logout`,
      introspection_endpoint: `${issuer}/oauth/introspect`,
      userinfo_endpoint: `${issuer}/oidc/userinfo`,
      jwks_uri: `${issuer}/.well-known/jwks.json`,
      response_types_supported: ['code'],
      grant_types_supported: [
        'authorization_code',
        'refresh_token',
        'client_credentials',
        'urn:ietf:params:oauth:grant-type:token-exchange',
      ],
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['RS256'],
      code_challenge_methods_supported: ['S256', 'plain'],
      scopes_supported: ['openid', 'profile', 'email', 'offline_access'],
      token_endpoint_auth_methods_supported: ['client_secret_post', 'none'],
    };
  }

  getUserInfo(authorizationHeader?: string) {
    const accessToken = this.extractBearerToken(authorizationHeader);
    return this.oauthService.getUserInfo(accessToken);
  }

  private extractBearerToken(authorizationHeader?: string) {
    const [scheme, token] = authorizationHeader?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Bearer access token is required');
    }
    return token;
  }
}
