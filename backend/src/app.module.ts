import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import appConfig from './config/app.config';
import cookieConfig from './config/cookie.config';
import databaseConfig from './config/database.config';
import emailConfig from './config/email.config';
import { envValidationSchema } from './config/env.validation';
import jwtConfig from './config/jwt.config';
import { DatabaseModule } from './database/database.module';
import { AccountsModule } from './modules/accounts/accounts.module';
import { AuthModule } from './modules/auth/auth.module';
import { ExternalAccountsModule } from './modules/external-accounts/external-accounts.module';
import { HealthModule } from './modules/health/health.module';
import { IdentityEventsModule } from './modules/identity-events/identity-events.module';
import { MailModule } from './modules/mail/mail.module';
import { ConsentsModule } from './modules/consents/consents.module';
import { JwksModule } from './modules/jwks/jwks.module';
import { OAuthModule } from './modules/oauth/oauth.module';
import { OAuthClientsModule } from './modules/oauth-clients/oauth-clients.module';
import { OidcModule } from './modules/oidc/oidc.module';
import { RefreshTokensModule } from './modules/refresh-tokens/refresh-tokens.module';
import { SessionsModule } from './modules/sessions/sessions.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      load: [
        appConfig,
        cookieConfig,
        databaseConfig,
        emailConfig,
        jwtConfig,
      ],
      validationSchema: envValidationSchema,
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
      },
    }),
    DatabaseModule,
    HealthModule,
    UsersModule,
    MailModule,
    SessionsModule,
    RefreshTokensModule,
    AuthModule,
    ExternalAccountsModule,
    IdentityEventsModule,
    AccountsModule,
    ConsentsModule,
    JwksModule,
    OAuthModule,
    OAuthClientsModule,
    OidcModule,
  ],
})
export class AppModule {}
