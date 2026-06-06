import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { AuthenticatedUser } from '../../common/types/authenticated-request.type';
import { AssignPermissionDto } from './dtos/assign-permission.dto';
import { AssignUserRoleDto } from './dtos/assign-user-role.dto';
import { CreateRoleDto } from './dtos/create-role.dto';
import { UpdateRoleDto } from './dtos/update-role.dto';
import { RolePermissionEntity } from './entities/role-permission.entity';
import { RoleEntity } from './entities/role.entity';
import { UserRoleEntity } from './entities/user-role.entity';

const GLOBAL_ONLY_ROLES = new Set(['SUPER_ADMIN']);

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(RoleEntity)
    private readonly rolesRepository: Repository<RoleEntity>,
    @InjectRepository(RolePermissionEntity)
    private readonly rolePermissionsRepository: Repository<RolePermissionEntity>,
    @InjectRepository(UserRoleEntity)
    private readonly userRolesRepository: Repository<UserRoleEntity>,
  ) {}

  create(dto: CreateRoleDto) {
    const code = dto.code.toUpperCase();
    if (GLOBAL_ONLY_ROLES.has(code) && dto.tenantId) {
      throw new BadRequestException('SUPER_ADMIN must be global');
    }

    return this.rolesRepository.save(
      this.rolesRepository.create({
        ...dto,
        code,
        isSystem: dto.isSystem ?? false,
      }),
    );
  }

  findAll() {
    return this.rolesRepository.find({ order: { code: 'ASC' } });
  }

  async findOne(id: string) {
    const role = await this.rolesRepository.findOne({ where: { id } });
    if (!role) {
      throw new NotFoundException('Role not found');
    }
    return role;
  }

  async update(id: string, dto: UpdateRoleDto) {
    const role = await this.findOne(id);
    if (role.isSystem) {
      throw new ForbiddenException('System roles cannot be modified from API');
    }
    Object.assign(role, { ...dto, code: dto.code?.toUpperCase() ?? role.code });
    return this.rolesRepository.save(role);
  }

  async remove(id: string) {
    const role = await this.findOne(id);
    if (role.isSystem) {
      throw new ForbiddenException('System roles cannot be deleted from API');
    }
    await this.rolesRepository.softDelete(id);
  }

  async assignPermission(roleId: string, dto: AssignPermissionDto) {
    await this.findOne(roleId);
    return this.rolePermissionsRepository.save(
      this.rolePermissionsRepository.create({
        roleId,
        permissionId: dto.permissionId,
      }),
    );
  }

  async removePermission(roleId: string, permissionId: string) {
    await this.rolePermissionsRepository.delete({ roleId, permissionId });
  }

  async assignUserRole(userId: string, dto: AssignUserRoleDto) {
    await this.findOne(dto.roleId);
    return this.userRolesRepository.save(
      this.userRolesRepository.create({
        ...dto,
        userId,
      }),
    );
  }

  async removeUserRole(userId: string, roleId: string) {
    await this.userRolesRepository.delete({ userId, roleId });
  }

  async getEffectiveRoleCodes(user: AuthenticatedUser) {
    const roles = await this.findEffectiveUserRoles(user);
    return roles.map((userRole) => userRole.role.code);
  }

  async getEffectivePermissionCodes(user: AuthenticatedUser) {
    const roles = await this.findEffectiveUserRoles(user);
    const roleIds = roles.map((userRole) => userRole.roleId);
    if (roleIds.length === 0) {
      return [];
    }

    const rolePermissions = await this.rolePermissionsRepository
      .createQueryBuilder('rolePermission')
      .leftJoinAndSelect('rolePermission.permission', 'permission')
      .where('rolePermission.role_id IN (:...roleIds)', { roleIds })
      .getMany();

    return [...new Set(rolePermissions.map((item) => item.permission.code))];
  }

  private findEffectiveUserRoles(user: AuthenticatedUser) {
    return this.userRolesRepository.find({
      where: [
        {
          userId: user.id,
          tenantId: IsNull(),
          organizationId: IsNull(),
          teamId: IsNull(),
        },
        {
          userId: user.id,
          tenantId: user.tenantId ?? IsNull(),
          organizationId: IsNull(),
          teamId: IsNull(),
        },
        {
          userId: user.id,
          tenantId: user.tenantId ?? IsNull(),
          organizationId: user.organizationId ?? IsNull(),
          teamId: IsNull(),
        },
        {
          userId: user.id,
          tenantId: user.tenantId ?? IsNull(),
          organizationId: user.organizationId ?? IsNull(),
          teamId: user.teamId ?? IsNull(),
        },
      ],
      relations: { role: true },
    });
  }
}
