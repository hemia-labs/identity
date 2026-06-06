import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { SessionEntity } from '../../sessions/entities/session.entity';
import { TenantEntity } from '../../tenants/entities/tenant.entity';
import { UserEntity } from '../../users/entities/user.entity';

@Entity('sso_authorization_codes')
@Index('IDX_sso_authorization_codes_code_hash', ['codeHash'], { unique: true })
@Index('IDX_sso_authorization_codes_client_id', ['clientId'])
@Index('IDX_sso_authorization_codes_expires_at', ['expiresAt'])
export class SsoAuthorizationCodeEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'code_hash', length: 64 })
  codeHash: string;

  @Column({ name: 'client_id', length: 120 })
  clientId: string;

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

  @Column({ name: 'session_id', type: 'uuid' })
  sessionId: string;

  @ManyToOne(() => SessionEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'session_id' })
  session: SessionEntity;

  @Column({ name: 'redirect_uri', type: 'text' })
  redirectUri: string;

  @Column({ type: 'text', nullable: true })
  state?: string | null;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'used_at', type: 'timestamptz', nullable: true })
  usedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
