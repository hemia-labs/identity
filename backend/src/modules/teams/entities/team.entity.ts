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
import { TenantEntity } from '../../tenants/entities/tenant.entity';

@Entity('teams')
@Index(
  'IDX_teams_tenant_org_slug_active_unique',
  ['tenantId', 'organizationId', 'slug'],
  {
    unique: true,
    where: '"deleted_at" IS NULL',
  },
)
export class TeamEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

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

  @Column({ length: 160 })
  name: string;

  @Column({ length: 120 })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt?: Date | null;
}
