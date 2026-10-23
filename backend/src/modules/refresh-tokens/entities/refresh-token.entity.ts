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

@Entity('refresh_tokens')
@Index('IDX_refresh_tokens_session_id', ['sessionId'])
@Index('IDX_refresh_tokens_family_id', ['familyId'])
@Index('IDX_refresh_tokens_token_hash', ['tokenHash'])
@Index('IDX_refresh_tokens_expires_at', ['expiresAt'])
export class RefreshTokenEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'session_id', type: 'uuid' })
  sessionId: string;

  @ManyToOne(() => SessionEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'session_id' })
  session: SessionEntity;

  @Column({ name: 'family_id', type: 'uuid' })
  familyId: string;

  @Column({ name: 'token_hash', length: 255 })
  tokenHash: string;

  @Column({
    name: 'previous_token_hash',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  previousTokenHash?: string | null;

  @Column({ name: 'is_used', default: false })
  isUsed: boolean;

  @Column({ name: 'is_revoked', default: false })
  isRevoked: boolean;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'used_at', type: 'timestamptz', nullable: true })
  usedAt?: Date | null;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
