import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { OrganizationEntity } from '../../organizations/entities/organization.entity';
import { TeamEntity } from '../../teams/entities/team.entity';
import { TenantEntity } from '../../tenants/entities/tenant.entity';
import { UserEntity } from '../../users/entities/user.entity';
import { RoleEntity } from './role.entity';

@Entity('user_roles')
@Index('IDX_user_roles_user_context', [
  'userId',
  'tenantId',
  'organizationId',
  'teamId',
])
export class UserRoleEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @Column({ name: 'role_id', type: 'uuid' })
  roleId: string;

  @ManyToOne(() => RoleEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'role_id' })
  role: RoleEntity;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId?: string | null;

  @ManyToOne(() => TenantEntity, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'tenant_id' })
  tenant?: TenantEntity | null;

  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organizationId?: string | null;

  @ManyToOne(() => OrganizationEntity, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'organization_id' })
  organization?: OrganizationEntity | null;

  @Column({ name: 'team_id', type: 'uuid', nullable: true })
  teamId?: string | null;

  @ManyToOne(() => TeamEntity, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'team_id' })
  team?: TeamEntity | null;

  @Column({ name: 'system_id', type: 'varchar', length: 120, nullable: true })
  systemId?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
