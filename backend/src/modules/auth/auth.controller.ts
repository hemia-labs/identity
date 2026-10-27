import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { CurrentSession } from '../../common/decorators/current-session.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-request.type';
import {
  ACCESS_TOKEN_COOKIE,
  OAUTH_STATE_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from './constants/auth.constants';
import { InvitationOnboardingService } from './invitation-onboarding.service';
import {
  InvitationTokenDto,
  RegisterInvitationDto,
} from './dtos/invitation.dto';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dtos/password/change-password.dto';
import { ForgotPasswordDto } from './dtos/password/forgot-password.dto';
import { LoginDto } from './dtos/login.dto';
import { ResetPasswordDto } from './dtos/password/reset-password.dto';
import { GoogleAuthGuard } from './google/google-auth.guard';
import { UserEntity } from '../users/entities/user.entity';

type GoogleAuthenticatedRequest = Request & {
  user: UserEntity;
};

@Controller('auth')
export class AuthController {
  private readonly invitationAttempts = new Map<
    string,
    { count: number; resetAt: number }
  >();
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly invitationOnboarding: InvitationOnboardingService,
  ) {}

  @Post('invitations/preview')
  async invitationPreview(
    @Body() dto: InvitationTokenDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    const token = this.invitationToken(dto, request);
    const result = await this.invitationOnboarding.preview(token);
    response.cookie('hemia_invitation', token, {
      ...this.getBaseCookieOptions(),
      domain: undefined,
      maxAge: 3600000,
    });
    return result;
  }

  @Post('invitations/register')
  async invitationRegister(
    @Body() dto: RegisterInvitationDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    const user = await this.invitationOnboarding.register({
      ...dto,
      token: this.invitationToken(dto, request),
    });
    const result = await this.authService.loginExternalUser(
      user,
      this.getRequestMetadata(request),
    );
    this.setAccessCookie(response, result.accessToken);
    this.setRefreshCookie(response, result.refreshToken);
    return { session: result.session };
  }

  @UseGuards(JwtAuthGuard)
  @Post('invitations/accept')
  async invitationAccept(
    @Body() dto: InvitationTokenDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    const result = await this.invitationOnboarding.accept(
      this.invitationToken(dto, request),
      user.id,
    );
    response.clearCookie('hemia_invitation', {
      ...this.getBaseCookieOptions(),
      domain: undefined,
    });
    return result;
  }

  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(
      dto,
      this.getRequestMetadata(request),
    );
    this.setAccessCookie(response, result.accessToken);
    this.setRefreshCookie(response, result.refreshToken);
    return { session: result.session };
  }

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  googleLogin(): void {}

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleCallback(
    @Req() request: GoogleAuthenticatedRequest,
    @Res() response: Response,
  ) {
    const state = request.query.state;
    if (typeof state !== 'string') {
      throw new BadRequestException('OAuth state query parameter is required');
    }

    const redirectUri = this.authService.resolveGoogleRedirectUri(state);
    const result = await this.authService.loginExternalUser(
      request.user,
      this.getRequestMetadata(request),
    );

    response.clearCookie(OAUTH_STATE_COOKIE, this.getBaseCookieOptions());
    this.setAccessCookie(response, result.accessToken);
    this.setRefreshCookie(response, result.refreshToken);

    return response.redirect(redirectUri);
  }

  @Post('refresh')
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const token = request.cookies?.[REFRESH_TOKEN_COOKIE] as string | undefined;
    const result = await this.authService.refresh(token ?? '');
    this.setAccessCookie(response, result.accessToken);
    this.setRefreshCookie(response, result.refreshToken);
    return { session: result.session };
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Post('logout')
  async logout(
    @Req() request: Request & { user?: AuthenticatedUser | null },
    @Res({ passthrough: true }) response: Response,
  ) {
    let result = { revoked: false };
    try {
      result = request.user?.sessionId
        ? await this.authService.logout(request.user.sessionId)
        : result;
    } catch {
      result = { revoked: false };
    } finally {
      this.clearAuthCookies(response);
    }
    return { ...result, cleared: true };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout-all')
  async logoutAll(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.logoutAll(user.id);
    this.clearAuthCookies(response);
    return result;
  }

  @Post('clear')
  clear(@Res({ passthrough: true }) response: Response) {
    this.clearAuthCookies(response);
    return { cleared: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('session')
  getSession(@CurrentSession() sessionId: string) {
    return this.authService.getSession(sessionId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('check-session')
  checkSession(@CurrentSession() sessionId: string) {
    return this.authService.checkSession(sessionId);
  }

  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(user.id, dto);
  }

  private invitationToken(dto: InvitationTokenDto, request: Request): string {
    if (
      request.header('origin') !==
      new URL(this.configService.getOrThrow<string>('ID_FRONTEND_URL')).origin
    ) {
      throw new ForbiddenException('Invalid request origin');
    }
    const now = Date.now();
    for (const [key, attempt] of this.invitationAttempts)
      if (attempt.resetAt < now) this.invitationAttempts.delete(key);
    const ip = request.ip ?? 'unknown';
    const attempt = this.invitationAttempts.get(ip) ?? {
      count: 0,
      resetAt: now + 60000,
    };
    if (++attempt.count > 120 || this.invitationAttempts.size >= 10000)
      throw new HttpException(
        'Too many invitation attempts',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    this.invitationAttempts.set(ip, attempt);
    const token: unknown = dto.token ?? request.cookies?.hemia_invitation;
    if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{40,128}$/.test(token))
      throw new BadRequestException('Invitation token is required');
    return token;
  }

  private setRefreshCookie(response: Response, token: string) {
    response.cookie(REFRESH_TOKEN_COOKIE, token, {
      ...this.getBaseCookieOptions(),
      maxAge:
        this.configService.get<number>(
          'cookie.refreshTokenMaxAgeSeconds',
          2592000,
        ) * 1000,
    });
  }

  private setAccessCookie(response: Response, token: string) {
    response.cookie(ACCESS_TOKEN_COOKIE, token, {
      ...this.getBaseCookieOptions(),
      maxAge:
        this.configService.get<number>('cookie.accessTokenMaxAgeSeconds', 900) *
        1000,
    });
  }

  private clearAuthCookies(response: Response) {
    this.expireAuthCookie(response, ACCESS_TOKEN_COOKIE);
    this.expireAuthCookie(response, REFRESH_TOKEN_COOKIE);
  }

  private expireAuthCookie(response: Response, name: string) {
    const baseOptions = this.getBaseCookieOptions();
    const configuredDomain = baseOptions.domain;
    const paths = ['/', '/api/v1', '/api/v1/auth', '/oauth'];
    const domains = configuredDomain
      ? [configuredDomain, undefined]
      : [undefined];

    for (const path of paths) {
      for (const domain of domains) {
        response.cookie(name, '', {
          ...baseOptions,
          domain,
          path,
          expires: new Date(0),
          maxAge: 0,
        });
      }
    }
  }

  private getBaseCookieOptions() {
    return {
      httpOnly: true,
      secure: this.configService.get<boolean>('cookie.secure', false),
      sameSite: this.configService.get<'lax' | 'strict' | 'none'>(
        'cookie.sameSite',
        'lax',
      ),
      domain: this.configService.get<string | undefined>('cookie.domain'),
      path: '/',
    } as const;
  }

  private getRequestMetadata(request: Request) {
    return {
      ipAddress: request.ip,
      userAgent: request.header('user-agent'),
    };
  }
}
