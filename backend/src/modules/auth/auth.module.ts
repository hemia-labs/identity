import { JwksModule } from '../jwks/jwks.module';
import { InvitationOnboardingService } from './invitation-onboarding.service';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ExternalAccountsModule } from '../external-accounts/external-accounts.module';
import { ExternalAccountsService } from '../external-accounts/external-accounts.service';
import { RefreshTokensModule } from '../refresh-tokens/refresh-tokens.module';
import { SessionsModule } from '../sessions/sessions.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleAuthGuard } from './google/google-auth.guard';
import { GoogleStrategy } from './google/google.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    PassportModule,
    JwksModule,
    JwtModule.register({}),
    UsersModule,
    ExternalAccountsModule,
    SessionsModule,
    RefreshTokensModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    InvitationOnboardingService,
    JwtStrategy,
    {
      provide: GoogleStrategy,
      inject: [ConfigService, ExternalAccountsService, AuthService, InvitationOnboardingService],
      useFactory: (
        config: ConfigService,
        externalAccounts: ExternalAccountsService,
        auth: AuthService,
        invitations: InvitationOnboardingService,
      ) =>
        config.get<string>('GOOGLE_CLIENT_ID') &&
        config.get<string>('GOOGLE_CLIENT_SECRET')
          ? new GoogleStrategy(config, externalAccounts, auth, invitations)
          : null,
    },
    GoogleAuthGuard,
  ],
  exports: [AuthService],
})
export class AuthModule {}
