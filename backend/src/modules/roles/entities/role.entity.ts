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

@Entity('roles')
@Index('IDX_roles_global_code_active_unique', ['code'], {
  unique: true,
  where: '"tenant_id" IS NULL AND "deleted_at" IS NULL',
})
@Index('IDX_roles_tenant_code_active_unique', ['tenantId', 'code'], {
  unique: true,
  where: '"tenant_id" IS NOT NULL AND "deleted_at" IS NULL',
})
export class RoleEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId?: string | null;

  @ManyToOne(() => TenantEntity, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'tenant_id' })
  tenant?: TenantEntity | null;

  @Column({ length: 120 })
  code: string;

  @Column({ length: 160 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ name: 'is_system', default: false })
  isSystem: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt?: Date | null;
}
