import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import argon2 from 'argon2';
import { Repository } from 'typeorm';
import { CreateUserDto } from './dtos/create-user.dto';
import { UpdateUserDto } from './dtos/update-user.dto';
import { UserEntity, UserStatus } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
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

    return this.usersRepository.save(user);
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

  async update(id: string, dto: UpdateUserDto, tenantId?: string) {
    const user = await this.findOne(id, tenantId);

    Object.assign(user, {
      ...dto,
      email: dto.email?.toLowerCase() ?? user.email,
      username: dto.username?.toLowerCase() ?? user.username,
    });

    return this.usersRepository.save(user);
  }

  async updateStatus(id: string, status: UserStatus, tenantId?: string) {
    const user = await this.findOne(id, tenantId);
    user.status = status;
    user.lockedAt = status === UserStatus.Locked ? new Date() : user.lockedAt;

    return this.usersRepository.save(user);
  }

  async remove(id: string, tenantId?: string) {
    const user = await this.findOne(id, tenantId);
    user.status = UserStatus.Deleted;
    await this.usersRepository.save(user);
    await this.usersRepository.softDelete(id);
  }
}
