import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum OAuthClientType {
  Public = 'public',
  Confidential = 'confidential',
}

export enum OAuthClientStatus {
  Active = 'active',
  Suspended = 'suspended',
  Deleted = 'deleted',
}

@Entity('oauth_clients')
@Index('IDX_oauth_clients_client_id_active_unique', ['clientId'], {
  unique: true,
  where: '"deleted_at" IS NULL',
})
export class OAuthClientEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'client_id', length: 120 })
  clientId: string;

  @Column({ name: 'client_secret_hash', type: 'varchar', length: 255, nullable: true })
  clientSecretHash?: string | null;

  @Column({ type: 'enum', enum: OAuthClientType })
  type: OAuthClientType;

  @Column({ name: 'redirect_uris', type: 'text', array: true, default: '{}' })
  redirectUris: string[];

  @Column({ name: 'grant_types', type: 'text', array: true, default: '{}' })
  grantTypes: string[];

  @Column({ name: 'response_types', type: 'text', array: true, default: '{}' })
  responseTypes: string[];

  @Column({ type: 'text', array: true, default: '{}' })
  scopes: string[];

  @Column({
    type: 'enum',
    enum: OAuthClientStatus,
    default: OAuthClientStatus.Active,
  })
  status: OAuthClientStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt?: Date | null;
}
