import {
  BadRequestException,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';
import { AuthService } from '../auth.service';
import { OAUTH_STATE_COOKIE } from '../constants/auth.constants';

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {
    super();
  }

  getAuthenticateOptions(context: ExecutionContext): { state?: string } {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    if (
      typeof request.query.code === 'string' ||
      typeof request.query.error === 'string'
    ) {
      const state = request.query.state;
      const cookies = request.cookies as Record<string, unknown> | undefined;

      if (
        typeof state !== 'string' ||
        typeof cookies?.[OAUTH_STATE_COOKIE] !== 'string' ||
        state !== cookies[OAUTH_STATE_COOKIE]
      ) {
        throw new BadRequestException('Invalid OAuth state');
      }

      this.authService.resolveGoogleRedirectUri(state);
      return {};
    }

    const redirectUri = request.query.redirect_uri;
    if (typeof redirectUri !== 'string') {
      throw new BadRequestException('redirect_uri query parameter is required');
    }

    const state = this.authService.createGoogleOAuthState(redirectUri);
    response.cookie(OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      secure: this.configService.get<boolean>('cookie.secure', false),
      sameSite: this.configService.get<'lax' | 'strict' | 'none'>(
        'cookie.sameSite',
        'lax',
      ),
      domain: this.configService.get<string | undefined>('cookie.domain'),
      path: '/',
      maxAge: 1000 * 60 * 5,
    });

    return { state };
  }
}
