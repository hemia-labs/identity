import { Module } from '@nestjs/common';
import { IdentityEventsModule } from '../identity-events/identity-events.module';
import { InvitationsModule } from '../invitations/invitations.module';
import { MembershipsModule } from '../memberships/memberships.module';
import { OAuthModule } from '../oauth/oauth.module';
import { TeamsModule } from '../teams/teams.module';
import { UsersModule } from '../users/users.module';
import { ExternalApiController } from './external-api.controller';
import { ExternalApiService } from './external-api.service';
import { OAuthBearerGuard } from './guards/oauth-bearer.guard';

@Module({
  imports: [
    IdentityEventsModule,
    InvitationsModule,
    MembershipsModule,
    OAuthModule,
    TeamsModule,
    UsersModule,
  ],
  controllers: [ExternalApiController],
  providers: [ExternalApiService, OAuthBearerGuard],
})
export class ExternalApiModule {}
