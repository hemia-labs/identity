import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
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

export enum MembershipStatus {
  Active = 'active',
  Invited = 'invited',
  Suspended = 'suspended',
  Removed = 'removed',
}

@Entity('memberships')
@Index(
  'IDX_memberships_scope_active_unique',
  ['userId', 'tenantId', 'organizationId', 'teamId'],
  {
    unique: true,
    where: '"deleted_at" IS NULL',
  },
)
export class MembershipEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => UserEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @ManyToOne(() => TenantEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: TenantEntity;

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

  @Column({
    type: 'enum',
    enum: MembershipStatus,
    default: MembershipStatus.Invited,
  })
  status: MembershipStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt?: Date | null;
}
