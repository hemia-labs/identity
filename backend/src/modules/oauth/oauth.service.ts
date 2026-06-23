import { createHash, randomBytes, randomUUID } from 'crypto';
import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import argon2 from 'argon2';
import { IsNull, Repository } from 'typeorm';
import { AuthenticatedUser } from '../../common/types/authenticated-request.type';
import { ConsentsService } from '../consents/consents.service';
import { JwksService } from '../jwks/jwks.service';
import { RolesService } from '../roles/roles.service';
import { SessionsService } from '../sessions/sessions.service';
import { UsersService } from '../users/users.service';
import { OAuthAuthorizeQueryDto } from './dtos/oauth-authorize-query.dto';
import { OAuthIntrospectDto } from './dtos/oauth-introspect.dto';
import { OAuthRevokeDto } from './dtos/oauth-revoke.dto';
import { OAuthTokenDto } from './dtos/oauth-token.dto';
import { OAuthAuthorizationCodeEntity } from './entities/oauth-authorization-code.entity';
import {
  OAuthClientEntity,
  OAuthClientStatus,
  OAuthClientType,
} from './entities/oauth-client.entity';
import { OAuthTokenEntity } from './entities/oauth-token.entity';

const ACCESS_TOKEN_SECONDS = 900;
const REFRESH_TOKEN_SECONDS = 2_592_000;
const HEMIA_DOCS_CLIENT_ID = 'hemia-docs';

@Injectable()
export class OAuthService {
  constructor(
    @InjectRepository(OAuthClientEntity)
    private readonly clientsRepository: Repository<OAuthClientEntity>,
    @InjectRepository(OAuthAuthorizationCodeEntity)
    private readonly codesRepository: Repository<OAuthAuthorizationCodeEntity>,
    @InjectRepository(OAuthTokenEntity)
    private readonly tokensRepository: Repository<OAuthTokenEntity>,
    private readonly configService: ConfigService,
    private readonly consentsService: ConsentsService,
    private readonly jwksService: JwksService,
    private readonly jwtService: JwtService,
    private readonly rolesService: RolesService,
    private readonly sessionsService: SessionsService,
    private readonly usersService: UsersService,
  ) {}

  async authorize(query: OAuthAuthorizeQueryDto, user: AuthenticatedUser) {
    const client = await this.findActiveClient(query.client_id);
    this.assertGrantAllowed(client, 'authorization_code');
    this.assertRedirectUriAllowed(client, query.redirect_uri);
    this.assertScopesAllowed(client, query.scope);

    if (client.type === OAuthClientType.Public && !query.code_challenge) {
      throw new BadRequestException('PKCE is required');
    }

    const scopes = this.parseScopes(query.scope);
    const hasConsent =
      !client.requiresConsent ||
      (await this.consentsService.hasConsent(user.id, client.clientId, scopes));

    if (!hasConsent) {
      return this.buildRedirect(query.redirect_uri, {
        error: 'consent_required',
        state: query.state,
      });
    }

    const session = await this.sessionsService.findActive(user.sessionId);
    if (!session) {
      throw new UnauthorizedException('Session is inactive');
    }

    const code = this.createOpaqueToken();
    await this.codesRepository.save(
      this.codesRepository.create({
        codeHash: this.hashToken(code),
        clientId: client.clientId,
        userId: user.id,
        sessionId: user.sessionId,
        redirectUri: query.redirect_uri,
        scope: query.scope,
        codeChallenge: query.code_challenge,
        codeChallengeMethod: query.code_challenge_method,
        nonce: query.nonce,
        state: query.state,
        expiresAt: new Date(Date.now() + 120_000),
      }),
    );

    return this.buildRedirect(query.redirect_uri, { code, state: query.state });
  }

  async token(dto: OAuthTokenDto) {
    if (dto.grant_type === 'authorization_code') {
      return this.exchangeAuthorizationCode(dto);
    }

    if (dto.grant_type === 'refresh_token') {
      return this.exchangeRefreshToken(dto);
    }

    return this.clientCredentials(dto);
  }

  async revoke(dto: OAuthRevokeDto) {
    const tokenHash = this.hashToken(dto.token);
    const token = await this.tokensRepository.findOne({
      where: [{ tokenHash }, { refreshTokenHash: tokenHash }],
    });

    if (token) {
      token.revokedAt = new Date();
      await this.tokensRepository.save(token);
    }

    return { revoked: true };
  }

  async introspect(dto: OAuthIntrospectDto) {
    const token = await this.findActiveAccessToken(dto.token);

    if (!token) {
      return { active: false };
    }

    if (!token.userId || !token.sessionId) {
      return {
        active: true,
        client_id: token.clientId,
        scope: token.scope,
        exp: Math.floor(token.expiresAt.getTime() / 1000),
      };
    }

    const claims = await this.buildUserTokenClaims(
      token.clientId,
      token.userId,
      token.sessionId,
      token.scope,
    );

    if (!claims) {
      return { active: false };
    }

    return {
      active: true,
      client_id: token.clientId,
      scope: token.scope,
      exp: Math.floor(token.expiresAt.getTime() / 1000),
      sub: claims.sub,
      email: claims.email,
      name: claims.name,
      tenant_id: claims.tenant_id,
      organization_id: claims.organization_id,
      team_id: claims.team_id,
      session_id: claims.session_id,
      roles: claims.roles,
      permissions: claims.permissions,
    };
  }

  async getUserInfo(accessToken: string) {
    const token = await this.findActiveAccessToken(accessToken);
    if (!token?.userId) {
      throw new UnauthorizedException('Invalid access token');
    }

    const claims = await this.buildUserTokenClaims(
      token.clientId,
      token.userId,
      token.sessionId,
      token.scope,
    );

    if (!claims) {
      throw new UnauthorizedException('Invalid access token');
    }

    return {
      sub: claims.sub,
      email: claims.email,
      email_verified: true,
      name: claims.name,
      picture: claims.picture,
      tenant_id: claims.tenant_id,
      organization_id: claims.organization_id,
      team_id: claims.team_id,
      session_id: claims.session_id,
      roles: claims.roles,
      permissions: claims.permissions,
    };
  }

  private async exchangeAuthorizationCode(dto: OAuthTokenDto) {
    if (!dto.code || !dto.redirect_uri || !dto.code_verifier) {
      throw new BadRequestException(
        'code, redirect_uri and code_verifier are required',
      );
    }
    const client = await this.findActiveClient(dto.client_id);
    this.assertGrantAllowed(client, 'authorization_code');
    this.assertRedirectUriAllowed(client, dto.redirect_uri);
    await this.assertClientAuth(client, dto.client_secret);

    const code = await this.codesRepository.findOne({
      where: {
        codeHash: this.hashToken(dto.code),
        clientId: client.clientId,
        redirectUri: dto.redirect_uri,
        usedAt: IsNull(),
      },
    });

    if (!code) {
      throw new UnauthorizedException('Invalid authorization code');
    }

    if (code.expiresAt <= new Date()) {
      throw new UnauthorizedException('Authorization code expired');
    }

    this.assertPkce(
      dto.code_verifier,
      code.codeChallenge,
      code.codeChallengeMethod,
    );
    code.usedAt = new Date();
    await this.codesRepository.save(code);

    return this.issueUserTokens(
      client,
      code.userId,
      code.sessionId,
      code.scope,
      code.nonce,
    );
  }

  private async exchangeRefreshToken(dto: OAuthTokenDto) {
    if (!dto.refresh_token) {
      throw new BadRequestException('refresh_token is required');
    }

    const client = await this.findActiveClient(dto.client_id);
    this.assertGrantAllowed(client, 'refresh_token');
    await this.assertClientAuth(client, dto.client_secret);
    const refreshHash = this.hashToken(dto.refresh_token);
    const previousToken = await this.tokensRepository.findOne({
      where: { refreshTokenHash: refreshHash, clientId: client.clientId },
    });

    if (!previousToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (previousToken.revokedAt) {
      await this.revokeFamily(previousToken.familyId);
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    previousToken.revokedAt = new Date();
    await this.tokensRepository.save(previousToken);

    return this.issueUserTokens(
      client,
      previousToken.userId ?? undefined,
      previousToken.sessionId ?? undefined,
      previousToken.scope,
      undefined,
      previousToken.familyId,
    );
  }

  private async clientCredentials(dto: OAuthTokenDto) {
    const client = await this.findActiveClient(dto.client_id);
    this.assertGrantAllowed(client, 'client_credentials');

    if (client.type !== OAuthClientType.Confidential) {
      throw new UnauthorizedException(
        'Client credentials require a confidential client',
      );
    }

    await this.assertClientSecret(client, dto.client_secret);
    const requestedScope = dto.scope ?? client.scopes.join(' ');
    this.assertScopesAllowed(client, requestedScope);

    return this.issueClientToken(client, requestedScope);
  }

  private async issueUserTokens(
    client: OAuthClientEntity,
    userId: string | undefined,
    sessionId: string | undefined,
    scope: string,
    nonce?: string | null,
    familyId: string = randomUUID(),
  ) {
    if (!userId || !sessionId) {
      throw new UnauthorizedException('Invalid refresh token subject');
    }

    const accessToken = await this.signAccessToken(client, userId, sessionId, scope);
    const refreshToken = this.createOpaqueToken();
    const expiresAt = new Date(Date.now() + ACCESS_TOKEN_SECONDS * 1000);
    await this.tokensRepository.save(
      this.tokensRepository.create({
        tokenHash: this.hashToken(accessToken),
        refreshTokenHash: this.hashToken(refreshToken),
        clientId: client.clientId,
        userId,
        sessionId,
        scope,
        familyId,
        expiresAt,
      }),
    );

    const response: Record<string, unknown> = {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: ACCESS_TOKEN_SECONDS,
      refresh_token: refreshToken,
      scope,
    };

    if (this.parseScopes(scope).includes('openid')) {
      response.id_token = await this.signIdToken(
        client,
        userId,
        sessionId,
        scope,
        nonce,
      );
    }
    return response;
  }

  private async issueClientToken(client: OAuthClientEntity, scope: string) {
    const accessToken = this.createOpaqueToken();
    await this.tokensRepository.save(
      this.tokensRepository.create({
        tokenHash: this.hashToken(accessToken),
        clientId: client.clientId,
        scope,
        familyId: randomUUID(),
        expiresAt: new Date(Date.now() + ACCESS_TOKEN_SECONDS * 1000),
      }),
    );

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: ACCESS_TOKEN_SECONDS,
      scope,
    };
  }

  private async signIdToken(
    client: OAuthClientEntity,
    userId: string,
    sessionId: string,
    scope: string,
    nonce?: string | null,
  ) {
    const claims = await this.buildUserTokenClaims(
      client.clientId,
      userId,
      sessionId,
      scope,
    );

    if (!claims) {
      throw new UnauthorizedException('Session is inactive');
    }

    const key = await this.jwksService.getActiveKey();
    const issuer = this.configService.get<string>(
      'app.issuer',
      'https://id.hemia.cloud',
    );
    const audience =
      client.clientId === client.audience
        ? client.clientId
        : [client.clientId, client.audience];
    const options: JwtSignOptions = {
      algorithm: 'RS256',
      keyid: key.kid,
      issuer,
      audience,
      subject: claims.sub,
      expiresIn: '15m',
      privateKey: key.privateKey,
    };

    return this.jwtService.signAsync(
      {
        scope,
        nonce,
        azp: client.clientId,
        email: claims.email,
        email_verified: true,
        name: claims.name,
        picture: claims.picture,
        tenant_id: claims.tenant_id,
        organization_id: claims.organization_id,
        team_id: claims.team_id,
        session_id: claims.session_id,
        roles: claims.roles,
        permissions: claims.permissions,
      },
      options,
    );
  }

  private async signAccessToken(
    client: OAuthClientEntity,
    userId: string,
    sessionId: string,
    scope: string,
  ) {
    const claims = await this.buildUserTokenClaims(
      client.clientId,
      userId,
      sessionId,
      scope,
    );

    if (!claims) {
      throw new UnauthorizedException('Session is inactive');
    }

    if (
      client.clientId === HEMIA_DOCS_CLIENT_ID &&
      !this.hasPermission(claims.permissions, 'docs.access')
    ) {
      throw new UnauthorizedException('docs.access is required');
    }

    const key = await this.jwksService.getActiveKey();
    const issuer = this.configService.get<string>(
      'app.issuer',
      'https://id.hemia.cloud',
    );
    return this.jwtService.signAsync(
      {
        email: claims.email,
        name: claims.name,
        picture: claims.picture,
        tenant_id: claims.tenant_id,
        organization_id: claims.organization_id,
        team_id: claims.team_id,
        session_id: claims.session_id,
        roles: claims.roles,
        permissions: claims.permissions,
        scope,
      },
      {
        algorithm: 'RS256',
        audience: client.audience,
        expiresIn: `${ACCESS_TOKEN_SECONDS}s`,
        issuer,
        jwtid: randomUUID(),
        keyid: key.kid,
        privateKey: key.privateKey,
        subject: claims.sub,
      },
    );
  }

  private async buildUserTokenClaims(
    clientId: string,
    userId: string,
    sessionId: string | null | undefined,
    scope: string,
  ) {
    if (!sessionId) {
      return null;
    }

    const [session, user] = await Promise.all([
      this.sessionsService.findActive(sessionId),
      this.usersService.findOne(userId),
    ]);

    if (!session) {
      return null;
    }

    const authenticatedUser: AuthenticatedUser = {
      id: user.id,
      email: user.email,
      username: user.username,
      sessionId,
      tenantId: session.tenantId,
      organizationId: session.organizationId,
      teamId: session.teamId,
    };
    const [roles, permissions] = await Promise.all([
      this.rolesService.getEffectiveRoleCodes(authenticatedUser),
      this.rolesService.getEffectivePermissionCodes(authenticatedUser),
    ]);

    return {
      sub: user.id,
      email: user.email,
      name: `${user.firstName} ${user.lastName}`.trim(),
      picture: user.avatarUrl,
      tenant_id: session.tenantId,
      organization_id: session.organizationId,
      team_id: session.teamId,
      session_id: sessionId,
      roles,
      permissions,
      scope,
      client_id: clientId,
    };
  }

  private async findActiveClient(clientId: string) {
    const client = await this.clientsRepository.findOne({
      where: { clientId: clientId.toLowerCase() },
    });

    if (!client || client.status !== OAuthClientStatus.Active) {
      throw new UnauthorizedException('OAuth client is not active');
    }

    return client;
  }

  private async findActiveAccessToken(token: string) {
    const storedToken = await this.tokensRepository.findOne({
      where: { tokenHash: this.hashToken(token), revokedAt: IsNull() },
    });

    if (!storedToken || storedToken.expiresAt <= new Date()) {
      return null;
    }

    return storedToken;
  }

  private async assertClientAuth(client: OAuthClientEntity, secret?: string) {
    // Public clients authenticate with PKCE; confidential clients must prove the secret.
    if (client.type === OAuthClientType.Confidential) {
      await this.assertClientSecret(client, secret);
    }
  }

  private async assertClientSecret(client: OAuthClientEntity, secret?: string) {
    if (!client.clientSecretHash || !secret) {
      throw new UnauthorizedException('Invalid client secret');
    }

    const ok = await argon2.verify(client.clientSecretHash, secret);
    if (!ok) {
      throw new UnauthorizedException('Invalid client secret');
    }
  }

  private assertRedirectUriAllowed(
    client: OAuthClientEntity,
    redirectUri: string,
  ) {
    if (!client.redirectUris.includes(redirectUri)) {
      throw new BadRequestException('redirect_uri is not allowed');
    }
  }

  private assertGrantAllowed(client: OAuthClientEntity, grantType: string) {
    if (!client.grantTypes.includes(grantType)) {
      throw new BadRequestException('grant_type is not allowed');
    }
  }

  private assertScopesAllowed(client: OAuthClientEntity, scope: string) {
    const requested = this.parseScopes(scope);
    if (!requested.every((item) => client.scopes.includes(item))) {
      throw new BadRequestException('scope is not allowed');
    }
  }

  private assertPkce(verifier: string, challenge: string, method: string) {
    const actual =
      method === 'S256'
        ? createHash('sha256').update(verifier).digest('base64url')
        : verifier;

    if (actual !== challenge) {
      throw new UnauthorizedException('Invalid code_verifier');
    }
  }

  private async revokeFamily(familyId: string) {
    await this.tokensRepository.update(
      { familyId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  private buildRedirect(
    redirectUri: string,
    params: Record<string, string | undefined>,
  ) {
    const url = new URL(redirectUri);
    for (const [key, value] of Object.entries(params)) {
      if (value) {
        url.searchParams.set(key, value);
      }
    }
    return url.toString();
  }

  private parseScopes(scope: string) {
    return scope
      .split(' ')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private hasPermission(permissions: string[], permission: string) {
    const [resource] = permission.split('.');
    return (
      permissions.includes('*') ||
      permissions.includes(permission) ||
      permissions.includes(`${resource}.*`) ||
      permissions.includes('*.*')
    );
  }

  private createOpaqueToken() {
    return randomBytes(48).toString('base64url');
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
