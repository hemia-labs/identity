import { createHash, randomBytes } from 'crypto';
import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { AuthenticatedUser } from '../../common/types/authenticated-request.type';
import { AuthService } from '../auth/auth.service';
import { SessionsService } from '../sessions/sessions.service';
import { SsoClientsService } from '../sso-clients/sso-clients.service';
import { UsersService } from '../users/users.service';
import { AuthorizeQueryDto } from './dtos/authorize-query.dto';
import { CheckSessionQueryDto } from './dtos/check-session-query.dto';
import { TokenExchangeDto } from './dtos/token-exchange.dto';
import { SsoAuthorizationCodeEntity } from './entities/sso-authorization-code.entity';

@Injectable()
export class SsoService {
  constructor(
    @InjectRepository(SsoAuthorizationCodeEntity)
    private readonly codesRepository: Repository<SsoAuthorizationCodeEntity>,
    private readonly authService: AuthService,
    private readonly sessionsService: SessionsService,
    private readonly ssoClientsService: SsoClientsService,
    private readonly usersService: UsersService,
  ) {}

  async createAuthorizationRedirect(
    query: AuthorizeQueryDto,
    user: AuthenticatedUser,
  ) {
    const client = await this.ssoClientsService.findActiveByClientId(
      query.client_id,
    );
    this.assertRedirectUriAllowed(
      client.allowedRedirectUris,
      query.redirect_uri,
    );

    const session = await this.sessionsService.findActive(user.sessionId);
    if (!session) {
      throw new UnauthorizedException('Session is inactive');
    }

    const code = this.createOpaqueCode();
    await this.codesRepository.save(
      this.codesRepository.create({
        codeHash: this.hashCode(code),
        clientId: client.clientId,
        userId: user.id,
        tenantId: user.tenantId,
        sessionId: user.sessionId,
        redirectUri: query.redirect_uri,
        state: query.state,
        expiresAt: new Date(Date.now() + 120_000),
      }),
    );

    const callbackUrl = new URL(query.redirect_uri);
    callbackUrl.searchParams.set('code', code);
    if (query.state) {
      callbackUrl.searchParams.set('state', query.state);
    }

    return callbackUrl.toString();
  }

  async exchangeCode(dto: TokenExchangeDto) {
    const client = await this.ssoClientsService.findActiveByClientId(
      dto.clientId,
    );
    this.assertRedirectUriAllowed(client.allowedRedirectUris, dto.redirectUri);

    const code = await this.codesRepository.findOne({
      where: {
        codeHash: this.hashCode(dto.code),
        clientId: client.clientId,
        redirectUri: dto.redirectUri,
        usedAt: IsNull(),
      },
    });

    if (!code) {
      throw new UnauthorizedException('Invalid authorization code');
    }

    if (code.expiresAt <= new Date()) {
      throw new UnauthorizedException('Authorization code expired');
    }

    const session = await this.sessionsService.findActive(code.sessionId);
    if (!session) {
      throw new UnauthorizedException('Session is inactive');
    }

    const [user, authSession] = await Promise.all([
      this.usersService.findOne(code.userId),
      this.authService.getSession(code.sessionId),
    ]);

    code.usedAt = new Date();
    await this.codesRepository.save(code);

    return {
      clientId: client.clientId,
      user: {
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.avatarUrl,
        status: user.status,
      },
      tenantId: code.tenantId ?? null,
      sessionId: code.sessionId,
      expiresAt: authSession.expiresAt,
    };
  }

  async checkSession(query: CheckSessionQueryDto, user: AuthenticatedUser) {
    const client = await this.ssoClientsService.findActiveByClientId(
      query.client_id,
    );
    this.assertRedirectUriAllowed(
      client.allowedRedirectUris,
      query.redirect_uri,
    );

    const session = await this.sessionsService.findActive(user.sessionId);

    return {
      active: Boolean(session),
      clientId: client.clientId,
      tenantId: user.tenantId ?? null,
      sessionId: user.sessionId,
    };
  }

  logoutClient(query: CheckSessionQueryDto, user: AuthenticatedUser) {
    return {
      loggedOut: true,
      clientId: query.client_id,
      sessionId: user.sessionId,
    };
  }

  buildLoginRedirect(originalUrl: string) {
    const returnTo = encodeURIComponent(originalUrl);
    return `/login?returnTo=${returnTo}`;
  }

  private assertRedirectUriAllowed(
    allowedRedirectUris: string[],
    redirectUri: string,
  ) {
    if (!allowedRedirectUris.includes(redirectUri)) {
      throw new BadRequestException('redirect_uri is not allowed');
    }
  }

  private createOpaqueCode() {
    return randomBytes(32).toString('base64url');
  }

  private hashCode(code: string) {
    return createHash('sha256').update(code).digest('hex');
  }
}
