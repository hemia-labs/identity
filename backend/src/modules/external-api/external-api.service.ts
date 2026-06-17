import { Injectable, NotFoundException } from '@nestjs/common';
import { IdentityEventsService } from '../identity-events/identity-events.service';
import { MembershipEntity } from '../memberships/entities/membership.entity';
import { MembershipsService } from '../memberships/memberships.service';
import { TeamEntity } from '../teams/entities/team.entity';
import { TeamsService } from '../teams/teams.service';
import { UsersService } from '../users/users.service';
import { ExternalEventsQueryDto } from './dtos/external-events-query.dto';
import {
  ExternalTeamQueryDto,
  ExternalTeamsQueryDto,
} from './dtos/external-teams-query.dto';

@Injectable()
export class ExternalApiService {
  constructor(
    private readonly identityEventsService: IdentityEventsService,
    private readonly membershipsService: MembershipsService,
    private readonly teamsService: TeamsService,
    private readonly usersService: UsersService,
  ) {}

  async findUserByEmail(email: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.usersService.toBasicProfile(user);
  }

  async findUserBySub(sub: string) {
    const user = await this.usersService.findBySub(sub);
    return this.usersService.toBasicProfile(user);
  }

  async findMembershipsBySub(sub: string) {
    await this.usersService.findBySub(sub);
    const memberships = await this.membershipsService.findExternalByUser(sub);
    return memberships.map((membership) => this.toExternalMembership(membership));
  }

  async findTeams(query: ExternalTeamsQueryDto) {
    const teams = await this.teamsService.findExternal(query);
    return teams.map((team) => this.toExternalTeam(team));
  }

  async findTeamById(id: string, query: ExternalTeamQueryDto) {
    const team = await this.teamsService.findOne(id, query.tenantId);
    return this.toExternalTeam(team);
  }

  findEvents(query: ExternalEventsQueryDto) {
    return this.identityEventsService.findRecent({
      tenantId: query.tenantId,
      type: query.type,
      after: query.after ? new Date(query.after) : undefined,
      limit: query.limit,
    });
  }

  private toExternalMembership(membership: MembershipEntity) {
    return {
      id: membership.id,
      userId: membership.userId,
      tenantId: membership.tenantId,
      tenant: membership.tenant
        ? {
            id: membership.tenant.id,
            name: membership.tenant.name,
            slug: membership.tenant.slug,
            status: membership.tenant.status,
          }
        : undefined,
      organizationId: membership.organizationId,
      organization: membership.organization
        ? {
            id: membership.organization.id,
            name: membership.organization.name,
            slug: membership.organization.slug,
          }
        : undefined,
      teamId: membership.teamId,
      team: membership.team
        ? {
            id: membership.team.id,
            name: membership.team.name,
            slug: membership.team.slug,
          }
        : undefined,
      status: membership.status,
      createdAt: membership.createdAt,
      updatedAt: membership.updatedAt,
      deletedAt: membership.deletedAt,
    };
  }

  private toExternalTeam(team: TeamEntity) {
    return {
      id: team.id,
      tenantId: team.tenantId,
      organizationId: team.organizationId,
      name: team.name,
      slug: team.slug,
      description: team.description,
      createdAt: team.createdAt,
      updatedAt: team.updatedAt,
    };
  }
}
