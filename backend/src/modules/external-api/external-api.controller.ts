import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ExternalCreateInvitationDto } from '../invitations/dtos/create-invitation.dto';
import { InvitationsService } from '../invitations/invitations.service';
import { ExternalScopes } from './decorators/external-scopes.decorator';
import { ExternalEventsQueryDto } from './dtos/external-events-query.dto';
import {
  ExternalTeamQueryDto,
  ExternalTeamsQueryDto,
} from './dtos/external-teams-query.dto';
import { ExternalApiService } from './external-api.service';
import { OAuthBearerGuard } from './guards/oauth-bearer.guard';

@Controller('external')
@UseGuards(OAuthBearerGuard)
export class ExternalApiController {
  constructor(
    private readonly externalApiService: ExternalApiService,
    private readonly invitationsService: InvitationsService,
  ) {}

  @Get('users/by-email')
  @ExternalScopes('identity.users.read')
  findUserByEmail(@Query('email') email: string) {
    return this.externalApiService.findUserByEmail(email);
  }

  @Get('users/by-sub/:sub')
  @ExternalScopes('identity.users.read')
  findUserBySub(@Param('sub') sub: string) {
    return this.externalApiService.findUserBySub(sub);
  }

  @Get('users/:sub/memberships')
  @ExternalScopes('identity.memberships.read')
  findMembershipsBySub(@Param('sub') sub: string) {
    return this.externalApiService.findMembershipsBySub(sub);
  }

  @Get('teams')
  @ExternalScopes('identity.teams.read')
  findTeams(@Query() query: ExternalTeamsQueryDto) {
    return this.externalApiService.findTeams(query);
  }

  @Get('teams/:id')
  @ExternalScopes('identity.teams.read')
  findTeamById(@Param('id') id: string, @Query() query: ExternalTeamQueryDto) {
    return this.externalApiService.findTeamById(id, query);
  }

  @Post('invitations')
  @ExternalScopes('identity.invitations.write')
  createInvitation(@Body() dto: ExternalCreateInvitationDto) {
    return this.invitationsService.create(dto);
  }

  @Post('invitations/:id/resend')
  @ExternalScopes('identity.invitations.write')
  resendInvitation(@Param('id') id: string) {
    return this.invitationsService.resend(id);
  }

  @Post('invitations/:id/cancel')
  @ExternalScopes('identity.invitations.write')
  cancelInvitation(@Param('id') id: string) {
    return this.invitationsService.cancel(id);
  }

  @Get('events')
  @ExternalScopes('identity.events.read')
  findEvents(@Query() query: ExternalEventsQueryDto) {
    return this.externalApiService.findEvents(query);
  }
}
