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
import { TenantEntity } from '../../tenants/entities/tenant.entity';
import { OrganizationEntity } from '../../organizations/entities/organization.entity';
import { TeamEntity } from '../../teams/entities/team.entity';
import { UserEntity } from '../../users/entities/user.entity';

@Entity('sessions')
@Index('IDX_sessions_user_id', ['userId'])
@Index('IDX_sessions_tenant_id', ['tenantId'])
@Index('IDX_sessions_family_id', ['sessionFamilyId'])
@Index('IDX_sessions_expires_at', ['expiresAt'])
@Index('IDX_sessions_is_active', ['isActive'])
export class SessionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => UserEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

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

  @Column({ name: 'session_family_id', type: 'uuid' })
  sessionFamilyId: string;

  @Column({ name: 'refresh_token_hash', length: 255 })
  refreshTokenHash: string;

  @Column({ name: 'device_name', type: 'varchar', length: 160, nullable: true })
  deviceName?: string | null;

  @Column({ name: 'ip_address', type: 'inet', nullable: true })
  ipAddress?: string | null;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent?: string | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
