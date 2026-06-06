import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum SsoClientStatus {
  Active = 'active',
  Suspended = 'suspended',
  Deleted = 'deleted',
}

@Entity('sso_clients')
@Index('IDX_sso_clients_client_id_active_unique', ['clientId'], {
  unique: true,
  where: '"deleted_at" IS NULL',
})
export class SsoClientEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'client_id', length: 120 })
  clientId: string;

  @Column({ length: 160 })
  name: string;

  @Column({ name: 'allowed_redirect_uris', type: 'text', array: true })
  allowedRedirectUris: string[];

  @Column({ name: 'allowed_origins', type: 'text', array: true, default: '{}' })
  allowedOrigins: string[];

  @Column({
    type: 'enum',
    enum: SsoClientStatus,
    default: SsoClientStatus.Active,
  })
  status: SsoClientStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt?: Date | null;
}
