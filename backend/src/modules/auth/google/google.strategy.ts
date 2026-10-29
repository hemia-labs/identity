import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy } from 'passport-google-oauth20';
import { ExternalAccountsService } from '../../external-accounts/external-accounts.service';
import type { Request } from 'express';
import { AuthService } from '../auth.service';
import { InvitationOnboardingService } from '../invitation-onboarding.service';

type GoogleProfileJson = {
  email_verified?: boolean;
};

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    configService: ConfigService,
    private readonly externalAccountsService: ExternalAccountsService,
    private readonly authService: AuthService,
    private readonly invitations: InvitationOnboardingService,
  ) {
    super({
      clientID: configService.getOrThrow<string>('GOOGLE_CLIENT_ID'),
      clientSecret: configService.getOrThrow<string>('GOOGLE_CLIENT_SECRET'),
      callbackURL: configService.getOrThrow<string>('GOOGLE_CALLBACK_URL'),
      scope: ['email', 'profile'],
      passReqToCallback: true,
    });
  }

  async validate(
    request: Request,
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
  ) {
    const email = profile.emails?.[0]?.value;
    const emailVerified = Boolean(
      (profile._json as GoogleProfileJson | undefined)?.email_verified,
    );

    if (!email) {
      throw new UnauthorizedException('Google account has no email');
    }

    if (!emailVerified) {
      throw new UnauthorizedException('Google email must be verified');
    }

    const token = this.authService.resolveGoogleInvitationToken(
      String(request.query.state ?? ''),
      request.cookies?.hemia_invitation as string | undefined,
    );
    const invitation = token ? await this.invitations.preview(token) : undefined;
    if (invitation && invitation.email !== email.trim().toLowerCase()) {
      throw new UnauthorizedException('Sign in with the invited Google account');
    }

    return this.externalAccountsService.findOrCreateGoogleUser({
      googleId: profile.id,
      email,
      emailVerified,
      name: profile.displayName,
      avatarUrl: profile.photos?.[0]?.value,
    }, invitation?.email, invitation?.issuedAt);
  }
}
