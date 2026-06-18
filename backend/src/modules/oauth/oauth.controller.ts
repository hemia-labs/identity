import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import type {
  AuthenticatedRequest,
  AuthenticatedUser,
} from '../../common/types/authenticated-request.type';
import { AuthService } from '../auth/auth.service';
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from '../auth/constants/auth.constants';
import { OAuthAuthorizeQueryDto } from './dtos/oauth-authorize-query.dto';
import { OAuthIntrospectDto } from './dtos/oauth-introspect.dto';
import { OAuthRevokeDto } from './dtos/oauth-revoke.dto';
import { OAuthTokenDto } from './dtos/oauth-token.dto';
import { OAuthService } from './oauth.service';

@Controller('oauth')
export class OAuthController {
  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
    private readonly oauthService: OAuthService,
  ) {}

  @UseGuards(OptionalJwtAuthGuard)
  @Get('authorize')
  async authorize(
    @Query() query: OAuthAuthorizeQueryDto,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    const user = (request as AuthenticatedRequest).user;
    if (!user) {
      const frontendUrl =
        this.configService.getOrThrow<string>('app.frontendUrl');
      return response.redirect(
        `${frontendUrl}/login?returnTo=${encodeURIComponent(request.originalUrl)}`,
      );
    }

    const redirectUrl = await this.oauthService.authorize(query, user);
    return response.redirect(redirectUrl);
  }

  @Post('token')
  token(@Body() dto: OAuthTokenDto) {
    return this.oauthService.token(dto);
  }

  @Post('revoke')
  revoke(@Body() dto: OAuthRevokeDto) {
    return this.oauthService.revoke(dto);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Post('logout')
  async logout(
    @Req() request: Request & { user?: AuthenticatedUser | null },
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = request.user?.sessionId
      ? await this.authService.logout(request.user.sessionId)
      : { revoked: false };
    this.clearAuthCookies(response);
    return { ...result, cleared: true };
  }

  @Post('introspect')
  introspect(@Body() dto: OAuthIntrospectDto) {
    return this.oauthService.introspect(dto);
  }

  private clearAuthCookies(response: Response) {
    this.expireAuthCookie(response, ACCESS_TOKEN_COOKIE);
    this.expireAuthCookie(response, REFRESH_TOKEN_COOKIE);
  }

  private expireAuthCookie(response: Response, name: string) {
    const baseOptions = this.getBaseCookieOptions();
    const configuredDomain = baseOptions.domain;
    const paths = ['/', '/api/v1', '/api/v1/auth', '/oauth'];
    const domains = configuredDomain ? [configuredDomain, undefined] : [undefined];

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
}
