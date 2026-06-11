import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import argon2 from 'argon2';
import { Repository } from 'typeorm';
import {
  IdentityEventType,
} from '../identity-events/entities/identity-event.entity';
import { IdentityEventsService } from '../identity-events/identity-events.service';
import { CreateUserDto } from './dtos/create-user.dto';
import { UpdateUserDto } from './dtos/update-user.dto';
import { UserEntity, UserStatus } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
    private readonly identityEventsService: IdentityEventsService,
  ) {}

  async create(dto: CreateUserDto) {
    const passwordHash = dto.password
      ? await argon2.hash(dto.password, { type: argon2.argon2id })
      : null;
    const user = this.usersRepository.create({
      ...dto,
      email: dto.email.toLowerCase(),
      username: dto.username?.toLowerCase(),
      passwordHash,
      status: dto.status ?? UserStatus.Pending,
    });

    const saved = await this.usersRepository.save(user);
    await this.identityEventsService.emit({
      type: IdentityEventType.UserCreated,
      userId: saved.id,
      payload: { user: this.toBasicProfile(saved) },
    });
    return saved;
  }

  findAll(tenantId?: string) {
    const query = this.usersRepository
      .createQueryBuilder('user')
      .orderBy('user.createdAt', 'DESC');

    if (tenantId) {
      query
        .innerJoin('memberships', 'membership', 'membership.user_id = user.id')
        .andWhere('membership.tenant_id = :tenantId', { tenantId })
        .andWhere('membership.deleted_at IS NULL');
    }

    return query.getMany();
  }

  async findOne(id: string, tenantId?: string) {
    const query = this.usersRepository
      .createQueryBuilder('user')
      .where('user.id = :id', { id });

    if (tenantId) {
      query
        .innerJoin('memberships', 'membership', 'membership.user_id = user.id')
        .andWhere('membership.tenant_id = :tenantId', { tenantId })
        .andWhere('membership.deleted_at IS NULL');
    }

    const user = await query.getOne();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  findByIdentifier(identifier: string) {
    const normalized = identifier.toLowerCase();

    return this.usersRepository.findOne({
      where: [{ email: normalized }, { username: normalized }],
    });
  }

  findByEmail(email: string) {
    return this.usersRepository.findOne({
      where: { email: email.toLowerCase() },
    });
  }

  async findBySub(sub: string) {
    return this.findOne(sub);
  }

  async findOrCreateExternalUser(input: {
    email: string;
    firstName: string;
    lastName: string;
  }) {
    const existing = await this.findByEmail(input.email);
    if (existing) {
      if (existing.status !== UserStatus.Active) {
        existing.status = UserStatus.Active;
        return this.usersRepository.save(existing);
      }
      return existing;
    }

    return this.create({
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      status: UserStatus.Active,
    });
  }

  async update(id: string, dto: UpdateUserDto, tenantId?: string) {
    const user = await this.findOne(id, tenantId);

    Object.assign(user, {
      ...dto,
      email: dto.email?.toLowerCase() ?? user.email,
      username: dto.username?.toLowerCase() ?? user.username,
    });

    const saved = await this.usersRepository.save(user);
    await this.identityEventsService.emit({
      type: IdentityEventType.UserUpdated,
      userId: saved.id,
      payload: { user: this.toBasicProfile(saved) },
    });
    return saved;
  }

  async updateStatus(id: string, status: UserStatus, tenantId?: string) {
    const user = await this.findOne(id, tenantId);
    user.status = status;
    user.lockedAt = status === UserStatus.Locked ? new Date() : user.lockedAt;

    const saved = await this.usersRepository.save(user);
    await this.identityEventsService.emit({
      type:
        status === UserStatus.Locked || status === UserStatus.Inactive
          ? IdentityEventType.UserSuspended
          : IdentityEventType.UserUpdated,
      userId: saved.id,
      payload: { user: this.toBasicProfile(saved) },
    });
    return saved;
  }

  async remove(id: string, tenantId?: string) {
    const user = await this.findOne(id, tenantId);
    user.status = UserStatus.Deleted;
    await this.usersRepository.save(user);
    await this.usersRepository.softDelete(id);
    await this.identityEventsService.emit({
      type: IdentityEventType.UserDeleted,
      userId: user.id,
      payload: { user: this.toBasicProfile(user) },
    });
  }

  toBasicProfile(user: UserEntity) {
    return {
      sub: user.id,
      email: user.email,
      name: `${user.firstName} ${user.lastName}`.trim(),
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
      status: this.toExternalStatus(user.status),
      rawStatus: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      deletedAt: user.deletedAt,
    };
  }

  private toExternalStatus(status: UserStatus) {
    if (status === UserStatus.Active) {
      return 'active';
    }
    if (status === UserStatus.Deleted) {
      return 'deleted';
    }
    return 'suspended';
  }
}
