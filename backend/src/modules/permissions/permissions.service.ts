import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreatePermissionDto } from './dtos/create-permission.dto';
import { PermissionEntity } from './entities/permission.entity';

const BASE_PERMISSIONS: CreatePermissionDto[] = [
  { code: 'users.create', resource: 'users', action: 'create' },
  { code: 'users.read', resource: 'users', action: 'read' },
  { code: 'users.update', resource: 'users', action: 'update' },
  { code: 'users.delete', resource: 'users', action: 'delete' },
  { code: 'users.lock', resource: 'users', action: 'lock' },
  { code: 'users.unlock', resource: 'users', action: 'unlock' },
  { code: 'tenants.create', resource: 'tenants', action: 'create' },
  { code: 'tenants.read', resource: 'tenants', action: 'read' },
  { code: 'tenants.update', resource: 'tenants', action: 'update' },
  { code: 'tenants.suspend', resource: 'tenants', action: 'suspend' },
  { code: 'organizations.create', resource: 'organizations', action: 'create' },
  { code: 'organizations.read', resource: 'organizations', action: 'read' },
  { code: 'organizations.update', resource: 'organizations', action: 'update' },
  { code: 'organizations.delete', resource: 'organizations', action: 'delete' },
  { code: 'teams.create', resource: 'teams', action: 'create' },
  { code: 'teams.read', resource: 'teams', action: 'read' },
  { code: 'teams.update', resource: 'teams', action: 'update' },
  { code: 'teams.delete', resource: 'teams', action: 'delete' },
  { code: 'memberships.create', resource: 'memberships', action: 'create' },
  { code: 'memberships.read', resource: 'memberships', action: 'read' },
  { code: 'memberships.update', resource: 'memberships', action: 'update' },
  { code: 'memberships.delete', resource: 'memberships', action: 'delete' },
  { code: 'invitations.create', resource: 'invitations', action: 'create' },
  { code: 'invitations.read', resource: 'invitations', action: 'read' },
  { code: 'invitations.update', resource: 'invitations', action: 'update' },
  { code: 'identity.users.read', resource: 'identity.users', action: 'read' },
  {
    code: 'identity.memberships.read',
    resource: 'identity.memberships',
    action: 'read',
  },
  {
    code: 'identity.invitations.write',
    resource: 'identity.invitations',
    action: 'write',
  },
  { code: 'identity.events.read', resource: 'identity.events', action: 'read' },
  { code: 'roles.create', resource: 'roles', action: 'create' },
  { code: 'roles.read', resource: 'roles', action: 'read' },
  { code: 'roles.update', resource: 'roles', action: 'update' },
  { code: 'roles.delete', resource: 'roles', action: 'delete' },
  { code: 'roles.assign', resource: 'roles', action: 'assign' },
  { code: 'permissions.read', resource: 'permissions', action: 'read' },
  { code: 'permissions.assign', resource: 'permissions', action: 'assign' },
  { code: 'sessions.read', resource: 'sessions', action: 'read' },
  { code: 'sessions.revoke', resource: 'sessions', action: 'revoke' },
  { code: 'sso_clients.create', resource: 'sso_clients', action: 'create' },
  { code: 'sso_clients.read', resource: 'sso_clients', action: 'read' },
  { code: 'sso_clients.update', resource: 'sso_clients', action: 'update' },
  { code: 'sso_clients.delete', resource: 'sso_clients', action: 'delete' },
  { code: 'oauth_clients.create', resource: 'oauth_clients', action: 'create' },
  { code: 'oauth_clients.read', resource: 'oauth_clients', action: 'read' },
  { code: 'oauth_clients.update', resource: 'oauth_clients', action: 'update' },
  { code: 'oauth_clients.delete', resource: 'oauth_clients', action: 'delete' },
  { code: 'api_keys.create', resource: 'api_keys', action: 'create' },
  { code: 'api_keys.read', resource: 'api_keys', action: 'read' },
  { code: 'api_keys.revoke', resource: 'api_keys', action: 'revoke' },
  { code: 'audit_logs.read', resource: 'audit_logs', action: 'read' },
];

@Injectable()
export class PermissionsService {
  constructor(
    @InjectRepository(PermissionEntity)
    private readonly permissionsRepository: Repository<PermissionEntity>,
  ) {}

  create(dto: CreatePermissionDto) {
    return this.permissionsRepository.save(
      this.permissionsRepository.create({
        ...dto,
        code: dto.code.toLowerCase(),
        resource: dto.resource.toLowerCase(),
        action: dto.action.toLowerCase(),
      }),
    );
  }

  findAll() {
    return this.permissionsRepository.find({ order: { code: 'ASC' } });
  }

  async findOne(id: string) {
    const permission = await this.permissionsRepository.findOne({
      where: { id },
    });
    if (!permission) {
      throw new NotFoundException('Permission not found');
    }
    return permission;
  }

  async syncBasePermissions() {
    for (const permission of BASE_PERMISSIONS) {
      const exists = await this.permissionsRepository.findOne({
        where: { code: permission.code },
      });
      if (!exists) {
        await this.create(permission);
      }
    }
    return this.findAll();
  }
}
