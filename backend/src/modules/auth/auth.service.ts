import { randomBytes, createHash, randomUUID } from 'crypto';
import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import argon2 from 'argon2';
import { RefreshTokensService } from '../refresh-tokens/refresh-tokens.service';
import { SessionsService } from '../sessions/sessions.service';
import { UserEntity, UserStatus } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { ChangePasswordDto } from './dtos/password/change-password.dto';
import { ForgotPasswordDto } from './dtos/password/forgot-password.dto';
import { LoginDto } from './dtos/login.dto';
import { ResetPasswordDto } from './dtos/password/reset-password.dto';
import { OAuthStatePayload } from './google/oauth-state-payload.type';

type RequestMetadata = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
    private readonly sessionsService: SessionsService,
    private readonly refreshTokensService: RefreshTokensService,
  ) {}

  async login(dto: LoginDto, metadata: RequestMetadata) {
    const user = await this.usersService.findByIdentifier(dto.identifier);

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await argon2.verify(
      user.passwordHash,
      dto.password,
    );
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    this.assertUserCanLogin(user);

    const refreshToken = this.createOpaqueToken();
    const refreshTokenHash = this.hashToken(refreshToken);
    const refreshExpiresAt = this.getDateFromDuration(
      this.configService.get<string>('jwt.refreshExpiresIn', '30d'),
    );
    const session = await this.sessionsService.create({
      userId: user.id,
      refreshTokenHash,
      deviceName: dto.deviceName,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      expiresAt: refreshExpiresAt,
    });

    await this.refreshTokensService.create({
      sessionId: session.id,
      familyId: session.sessionFamilyId,
      tokenHash: refreshTokenHash,
      expiresAt: refreshExpiresAt,
    });

    return {
      accessToken: await this.signAccessToken(user, session.id),
      refreshToken,
      session: this.toAuthSession(user, session.id, session.expiresAt),
    };
  }

  async loginExternalUser(user: UserEntity, metadata: RequestMetadata) {
    this.assertUserCanLogin(user);

    const refreshToken = this.createOpaqueToken();
    const refreshTokenHash = this.hashToken(refreshToken);
    const refreshExpiresAt = this.getDateFromDuration(
      this.configService.get<string>('jwt.refreshExpiresIn', '30d'),
    );
    const session = await this.sessionsService.create({
      userId: user.id,
      refreshTokenHash,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      expiresAt: refreshExpiresAt,
    });

    await this.refreshTokensService.create({
      sessionId: session.id,
      familyId: session.sessionFamilyId,
      tokenHash: refreshTokenHash,
      expiresAt: refreshExpiresAt,
    });

    return {
      accessToken: await this.signAccessToken(user, session.id),
      refreshToken,
      session: this.toAuthSession(user, session.id, session.expiresAt),
    };
  }

  createGoogleOAuthState(redirectUri: string, invitationToken?: string) {
    this.assertAllowedRedirectUri(redirectUri);

    return this.jwtService.sign(
      {
        nonce: randomUUID(),
        purpose: 'google_login_redirect',
        redirectUri,
        ...(invitationToken && { invitationTokenHash: this.hashToken(invitationToken) }),
      } satisfies OAuthStatePayload,
      {
        secret: this.configService.getOrThrow<string>('OAUTH_STATE_SECRET'),
        expiresIn: '5m',
      },
    );
  }

  resolveGoogleRedirectUri(state: string) {
    return this.resolveGoogleState(state).redirectUri;
  }

  resolveGoogleInvitationToken(state: string, token?: string): string | undefined {
    const payload = this.resolveGoogleState(state);
    if (!payload.invitationTokenHash) return undefined;
    if (!token || this.hashToken(token) !== payload.invitationTokenHash) {
      throw new BadRequestException('Invalid invitation OAuth state');
    }
    return token;
  }

  private resolveGoogleState(state: string) {
    try {
      const payload = this.jwtService.verify<OAuthStatePayload>(state, {
        secret: this.configService.getOrThrow<string>('OAUTH_STATE_SECRET'),
      });

      if (payload.purpose !== 'google_login_redirect') {
        throw new Error('Invalid OAuth state purpose');
      }

      this.assertAllowedRedirectUri(payload.redirectUri);
      return payload;
    } catch {
      throw new BadRequestException('Invalid or expired OAuth state');
    }
  }

  async refresh(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    const storedToken = await this.refreshTokensService.findByHash(tokenHash);

    if (!storedToken || !storedToken.session) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (storedToken.isUsed || storedToken.isRevoked) {
      await Promise.all([
        this.refreshTokensService.revokeFamily(storedToken.familyId),
        this.sessionsService.revokeFamily(storedToken.session.sessionFamilyId),
      ]);
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    if (storedToken.expiresAt <= new Date()) {
      await this.sessionsService.revoke(storedToken.sessionId);
      throw new UnauthorizedException('Refresh token expired');
    }

    const session = await this.sessionsService.findActive(
      storedToken.sessionId,
    );
    if (!session) {
      throw new UnauthorizedException('Session is inactive');
    }

    const user = await this.usersService.findOne(session.userId);
    this.assertUserCanLogin(user);

    const nextRefreshToken = this.createOpaqueToken();
    const nextRefreshTokenHash = this.hashToken(nextRefreshToken);
    const refreshExpiresAt = this.getDateFromDuration(
      this.configService.get<string>('jwt.refreshExpiresIn', '30d'),
    );

    await this.refreshTokensService.markUsed(storedToken.id);
    await this.sessionsService.updateRefreshHash(
      session.id,
      nextRefreshTokenHash,
    );
    await this.refreshTokensService.create({
      sessionId: session.id,
      familyId: session.sessionFamilyId,
      tokenHash: nextRefreshTokenHash,
      previousTokenHash: tokenHash,
      expiresAt: refreshExpiresAt,
    });

    return {
      accessToken: await this.signAccessToken(user, session.id),
      refreshToken: nextRefreshToken,
      session: this.toAuthSession(user, session.id, session.expiresAt),
    };
  }

  async logout(sessionId: string) {
    await this.sessionsService.revoke(sessionId);
    return { revoked: true };
  }

  async logoutAll(userId: string) {
    await this.sessionsService.revokeAllForUser(userId);
    return { revoked: true };
  }

  async getSession(sessionId: string) {
    const session = await this.sessionsService.findActive(sessionId);
    if (!session) {
      throw new UnauthorizedException('Session is inactive');
    }

    const user = await this.usersService.findOne(session.userId);
    return this.toAuthSession(user, session.id, session.expiresAt);
  }

  async issueAccessTokenForSession(sessionId: string) {
    const session = await this.sessionsService.findActive(sessionId);
    if (!session) {
      throw new UnauthorizedException('Session is inactive');
    }

    const user = await this.usersService.findOne(session.userId);

    return {
      accessToken: await this.signAccessToken(user, session.id),
      session: this.toAuthSession(user, session.id, session.expiresAt),
    };
  }

  checkSession(sessionId?: string) {
    return { active: Boolean(sessionId) };
  }

  forgotPassword(_dto: ForgotPasswordDto) {
    void _dto;
    return { accepted: true };
  }

  resetPassword(_dto: ResetPasswordDto) {
    void _dto;
    throw new BadRequestException('Password reset is not configured yet');
  }

  changePassword(_userId: string, _dto: ChangePasswordDto) {
    void _userId;
    void _dto;
    throw new BadRequestException('Password change is not configured yet');
  }

  private assertUserCanLogin(user: UserEntity) {
    if (
      [UserStatus.Locked, UserStatus.Deleted, UserStatus.Inactive].includes(
        user.status,
      )
    ) {
      throw new UnauthorizedException('User cannot login');
    }
  }

  private signAccessToken(user: UserEntity, sessionId: string) {
    const options: JwtSignOptions = {
      subject: user.id,
      secret: this.configService.getOrThrow<string>('jwt.accessSecret'),
      expiresIn: this.configService.get<string>(
        'jwt.accessExpiresIn',
        '15m',
      ) as JwtSignOptions['expiresIn'],
    };

    return this.jwtService.signAsync(
      {
        email: user.email,
        username: user.username,
        sessionId,
      },
      options,
    );
  }

  private toAuthSession(user: UserEntity, sessionId: string, expiresAt: Date) {
    return {
      user: {
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.avatarUrl,
        status: user.status,
      },
      sessionId,
      expiresAt,
    };
  }

  private createOpaqueToken() {
    return randomBytes(48).toString('base64url');
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private getDateFromDuration(duration: string) {
    const match = duration.match(/^(\d+)([mhd])$/);
    if (!match) {
      return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }

    const amount = Number(match[1]);
    const unit = match[2];
    const multiplier =
      unit === 'm' ? 60_000 : unit === 'h' ? 3_600_000 : 86_400_000;

    return new Date(Date.now() + amount * multiplier);
  }

  private assertAllowedRedirectUri(redirectUri: string) {
    const allowedRedirectUris = this.configService
      .get<string>('AUTH_ALLOWED_REDIRECT_URIS', '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    if (!allowedRedirectUris.includes(redirectUri)) {
      throw new BadRequestException('redirect_uri is not allowed');
    }
  }
}
