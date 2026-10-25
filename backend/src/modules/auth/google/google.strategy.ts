import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy } from 'passport-google-oauth20';
import { ExternalAccountsService } from '../../external-accounts/external-accounts.service';

type GoogleProfileJson = {
  email_verified?: boolean;
};

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    configService: ConfigService,
    private readonly externalAccountsService: ExternalAccountsService,
  ) {
    super({
      clientID: configService.getOrThrow<string>('GOOGLE_CLIENT_ID'),
      clientSecret: configService.getOrThrow<string>('GOOGLE_CLIENT_SECRET'),
      callbackURL: configService.getOrThrow<string>('GOOGLE_CALLBACK_URL'),
      scope: ['email', 'profile'],
    });
  }

  async validate(
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

    return this.externalAccountsService.findOrCreateGoogleUser({
      googleId: profile.id,
      email,
      emailVerified,
      name: profile.displayName,
      avatarUrl: profile.photos?.[0]?.value,
    });
  }
}
