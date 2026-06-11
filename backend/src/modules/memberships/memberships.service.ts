import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  IdentityEventType,
} from '../identity-events/entities/identity-event.entity';
import { IdentityEventsService } from '../identity-events/identity-events.service';
import { CreateMembershipDto } from './dtos/create-membership.dto';
import {
  MembershipEntity,
  MembershipStatus,
} from './entities/membership.entity';

@Injectable()
export class MembershipsService {
  constructor(
    @InjectRepository(MembershipEntity)
    private readonly membershipsRepository: Repository<MembershipEntity>,
    private readonly identityEventsService: IdentityEventsService,
  ) {}

  async create(tenantId: string, dto: CreateMembershipDto) {
    const membership = await this.membershipsRepository.save(
      this.membershipsRepository.create({
        ...dto,
        tenantId,
        status: dto.status ?? MembershipStatus.Invited,
      }),
    );
    if (membership.status === MembershipStatus.Active) {
      await this.emitMembershipAdded(membership);
    }
    return membership;
  }

  findAll(tenantId?: string) {
    return this.membershipsRepository.find({
      where: { ...(tenantId ? { tenantId } : {}) },
      order: { createdAt: 'DESC' },
    });
  }

  findByUser(userId: string, tenantId?: string) {
    return this.membershipsRepository.find({
      where: { userId, ...(tenantId ? { tenantId } : {}) },
    });
  }

  findExternalByUser(userId: string) {
    return this.membershipsRepository.find({
      where: { userId },
      relations: { tenant: true, organization: true, team: true },
      order: { createdAt: 'DESC' },
    });
  }

  async upsertActiveMembership(input: {
    userId: string;
    tenantId: string;
    organizationId?: string | null;
    teamId?: string | null;
  }) {
    const query = this.membershipsRepository
      .createQueryBuilder('membership')
      .where('membership.user_id = :userId', { userId: input.userId })
      .andWhere('membership.tenant_id = :tenantId', { tenantId: input.tenantId });

    if (input.organizationId) {
      query.andWhere('membership.organization_id = :organizationId', {
        organizationId: input.organizationId,
      });
    } else {
      query.andWhere('membership.organization_id IS NULL');
    }

    if (input.teamId) {
      query.andWhere('membership.team_id = :teamId', {
        teamId: input.teamId,
      });
    } else {
      query.andWhere('membership.team_id IS NULL');
    }

    const existing = await query.getOne();

    if (existing) {
      existing.status = MembershipStatus.Active;
      const saved = await this.membershipsRepository.save(existing);
      await this.emitMembershipAdded(saved);
      return saved;
    }

    return this.create(input.tenantId, {
      userId: input.userId,
      tenantId: input.tenantId,
      organizationId: input.organizationId ?? undefined,
      teamId: input.teamId ?? undefined,
      status: MembershipStatus.Active,
    });
  }

  findActiveByUser(userId: string) {
    return this.membershipsRepository.find({
      where: { userId, status: MembershipStatus.Active },
      order: { createdAt: 'ASC' },
    });
  }

  async findActiveAccountByIndex(userId: string, accountIndex: number) {
    const memberships = await this.findActiveByUser(userId);
    const membership = memberships[accountIndex];

    if (!membership) {
      throw new NotFoundException('Active membership not found');
    }

    return membership;
  }

  async findOne(id: string, tenantId?: string) {
    const membership = await this.membershipsRepository.findOne({
      where: { id, ...(tenantId ? { tenantId } : {}) },
    });
    if (!membership) {
      throw new NotFoundException('Membership not found');
    }
    return membership;
  }

  async updateStatus(id: string, tenantId: string, status: MembershipStatus) {
    const membership = await this.findOne(id, tenantId);
    const previousStatus = membership.status;
    membership.status = status;
    const saved = await this.membershipsRepository.save(membership);
    if (
      previousStatus === MembershipStatus.Active &&
      status !== MembershipStatus.Active
    ) {
      await this.emitMembershipRemoved(saved);
    }
    if (
      previousStatus !== MembershipStatus.Active &&
      status === MembershipStatus.Active
    ) {
      await this.emitMembershipAdded(saved);
    }
    return saved;
  }

  async remove(id: string, tenantId: string) {
    const membership = await this.findOne(id, tenantId);
    await this.membershipsRepository.softDelete(id);
    await this.emitMembershipRemoved(membership);
  }

  private async emitMembershipAdded(membership: MembershipEntity) {
    const type = membership.teamId
      ? IdentityEventType.TeamMemberAdded
      : IdentityEventType.OrgMemberAdded;
    await this.identityEventsService.emit({
      type,
      tenantId: membership.tenantId,
      organizationId: membership.organizationId,
      teamId: membership.teamId,
      userId: membership.userId,
      payload: { membershipId: membership.id, status: membership.status },
    });
  }

  private async emitMembershipRemoved(membership: MembershipEntity) {
    const type = membership.teamId
      ? IdentityEventType.TeamMemberRemoved
      : IdentityEventType.OrgMemberRemoved;
    await this.identityEventsService.emit({
      type,
      tenantId: membership.tenantId,
      organizationId: membership.organizationId,
      teamId: membership.teamId,
      userId: membership.userId,
      payload: { membershipId: membership.id, status: membership.status },
    });
  }
}
