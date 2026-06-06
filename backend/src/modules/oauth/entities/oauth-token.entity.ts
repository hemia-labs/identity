import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('oauth_tokens')
@Index('IDX_oauth_tokens_token_hash', ['tokenHash'], { unique: true })
@Index('IDX_oauth_tokens_refresh_token_hash', ['refreshTokenHash'])
@Index('IDX_oauth_tokens_client_id', ['clientId'])
@Index('IDX_oauth_tokens_family_id', ['familyId'])
export class OAuthTokenEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'token_hash', length: 64 })
  tokenHash: string;

  @Column({ name: 'refresh_token_hash', type: 'varchar', length: 64, nullable: true })
  refreshTokenHash?: string | null;

  @Column({ name: 'client_id', length: 120 })
  clientId: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId?: string | null;

  @Column({ name: 'session_id', type: 'uuid', nullable: true })
  sessionId?: string | null;

  @Column({ type: 'text' })
  scope: string;

  @Column({ name: 'family_id', type: 'uuid' })
  familyId: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
