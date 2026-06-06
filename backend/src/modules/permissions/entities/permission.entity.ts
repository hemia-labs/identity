import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('permissions')
@Index('IDX_permissions_code_unique', ['code'], { unique: true })
export class PermissionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 160 })
  code: string;

  @Column({ length: 80 })
  resource: string;

  @Column({ length: 80 })
  action: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
