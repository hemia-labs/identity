import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
  ) {}

  create(tenantId: string, dto: CreateMembershipDto) {
    return this.membershipsRepository.save(
      this.membershipsRepository.create({
        ...dto,
        tenantId,
        status: dto.status ?? MembershipStatus.Invited,
      }),
    );
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
    membership.status = status;
    return this.membershipsRepository.save(membership);
  }

  async remove(id: string, tenantId: string) {
    await this.findOne(id, tenantId);
    await this.membershipsRepository.softDelete(id);
  }
}
