import {
  BadRequestException,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';
import { isObservable, lastValueFrom } from 'rxjs';
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

  canActivate(context: ExecutionContext) {
    if (
      !this.configService.get<string>('GOOGLE_CLIENT_ID') ||
      !this.configService.get<string>('GOOGLE_CLIENT_SECRET')
    ) {
      throw new ServiceUnavailableException('Google sign-in is not configured');
    }
    return this.authenticate(context);
  }

  private async authenticate(context: ExecutionContext): Promise<boolean> {
    try {
      const result = super.canActivate(context);
      return await (isObservable(result) ? lastValueFrom(result) : result);
    } catch (error) {
      const request = context.switchToHttp().getRequest<Request>();
      const state = request.query.state;
      // Only return to a signed, allowed destination bound to this browser.
      if (
        typeof state !== 'string' ||
        state !== request.cookies?.[OAUTH_STATE_COOKIE]
      ) {
        throw error;
      }
      const redirect = new URL(
        this.authService.resolveGoogleRedirectUri(state),
      );
      redirect.searchParams.set(
        'error',
        error instanceof ForbiddenException &&
          error.message === 'GOOGLE_ACCOUNT_LINK_REQUIRED'
          ? 'account_link_required'
          : 'google_auth_failed',
      );
      const response = context.switchToHttp().getResponse<Response>();
      response.clearCookie(OAUTH_STATE_COOKIE, {
        domain: this.configService.get<string | undefined>('cookie.domain'),
        path: '/',
      });
      response.redirect(redirect.toString());
      return false;
    }
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
