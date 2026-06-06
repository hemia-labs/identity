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
import { TenantEntity } from '../../tenants/entities/tenant.entity';

@Entity('organizations')
@Index('IDX_organizations_tenant_slug_active_unique', ['tenantId', 'slug'], {
  unique: true,
  where: '"deleted_at" IS NULL',
})
export class OrganizationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @ManyToOne(() => TenantEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: TenantEntity;

  @Column({ length: 160 })
  name: string;

  @Column({ length: 120 })
  slug: string;

  @Column({ name: 'legal_name', type: 'varchar', length: 240, nullable: true })
  legalName?: string | null;

  @Column({ name: 'tax_id', type: 'varchar', length: 80, nullable: true })
  taxId?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  branding?: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  settings?: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt?: Date | null;
}
