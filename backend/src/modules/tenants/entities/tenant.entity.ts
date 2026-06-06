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
import { UserEntity } from '../../users/entities/user.entity';

export enum TenantStatus {
  Trial = 'trial',
  Active = 'active',
  Suspended = 'suspended',
  Cancelled = 'cancelled',
  Deleted = 'deleted',
}

@Entity('tenants')
@Index('IDX_tenants_slug_active_unique', ['slug'], {
  unique: true,
  where: '"deleted_at" IS NULL',
})
export class TenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 160 })
  name: string;

  @Column({ length: 120 })
  slug: string;

  @Column({
    type: 'enum',
    enum: TenantStatus,
    default: TenantStatus.Trial,
  })
  status: TenantStatus;

  @Column({ type: 'varchar', length: 80, nullable: true })
  plan?: string | null;

  @Column({ name: 'owner_user_id', type: 'uuid', nullable: true })
  ownerUserId?: string | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'owner_user_id' })
  ownerUser?: UserEntity | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt?: Date | null;
}
