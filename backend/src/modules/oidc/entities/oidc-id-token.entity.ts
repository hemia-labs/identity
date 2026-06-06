import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('oidc_id_tokens')
@Index('IDX_oidc_id_tokens_token_hash', ['tokenHash'], { unique: true })
export class OidcIdTokenEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'token_hash', length: 64 })
  tokenHash: string;

  @Column({ name: 'client_id', length: 120 })
  clientId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ length: 80 })
  kid: string;

  @Column({ type: 'text', nullable: true })
  nonce?: string | null;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
