import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import appConfig from './config/app.config';
import cookieConfig from './config/cookie.config';
import databaseConfig from './config/database.config';
import emailConfig from './config/email.config';
import { envValidationSchema } from './config/env.validation';
import jwtConfig from './config/jwt.config';
import redisConfig from './config/redis.config';
import { DatabaseModule } from './database/database.module';
import { AccountsModule } from './modules/accounts/accounts.module';
import { AuthModule } from './modules/auth/auth.module';
import { ExternalAccountsModule } from './modules/external-accounts/external-accounts.module';
import { ExternalApiModule } from './modules/external-api/external-api.module';
import { HealthModule } from './modules/health/health.module';
import { IdentityEventsModule } from './modules/identity-events/identity-events.module';
import { InvitationsModule } from './modules/invitations/invitations.module';
import { MembershipsModule } from './modules/memberships/memberships.module';
import { MailModule } from './modules/mail/mail.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { ConsentsModule } from './modules/consents/consents.module';
import { JwksModule } from './modules/jwks/jwks.module';
import { OAuthModule } from './modules/oauth/oauth.module';
import { OidcModule } from './modules/oidc/oidc.module';
import { PermissionsModule } from './modules/permissions/permissions.module';
import { RefreshTokensModule } from './modules/refresh-tokens/refresh-tokens.module';
import { RolesModule } from './modules/roles/roles.module';
import { SessionsModule } from './modules/sessions/sessions.module';
import { SsoClientsModule } from './modules/sso-clients/sso-clients.module';
import { SsoModule } from './modules/sso/sso.module';
import { TeamsModule } from './modules/teams/teams.module';
import { TenantsModule } from './modules/tenants/tenants.module';
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
        redisConfig,
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
    TenantsModule,
    OrganizationsModule,
    TeamsModule,
    MembershipsModule,
    MailModule,
    SessionsModule,
    RefreshTokensModule,
    AuthModule,
    ExternalAccountsModule,
    IdentityEventsModule,
    InvitationsModule,
    ExternalApiModule,
    AccountsModule,
    PermissionsModule,
    RolesModule,
    SsoClientsModule,
    SsoModule,
    ConsentsModule,
    JwksModule,
    OAuthModule,
    OidcModule,
  ],
})
export class AppModule {}
