import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('oauth_authorization_codes')
@Index('IDX_oauth_authorization_codes_code_hash', ['codeHash'], {
  unique: true,
})
@Index('IDX_oauth_authorization_codes_client_id', ['clientId'])
@Index('IDX_oauth_authorization_codes_expires_at', ['expiresAt'])
export class OAuthAuthorizationCodeEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'code_hash', length: 64 })
  codeHash: string;

  @Column({ name: 'client_id', length: 120 })
  clientId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'session_id', type: 'uuid' })
  sessionId: string;

  @Column({ name: 'redirect_uri', type: 'text' })
  redirectUri: string;

  @Column({ type: 'text' })
  scope: string;

  @Column({ name: 'code_challenge', type: 'text' })
  codeChallenge: string;

  @Column({ name: 'code_challenge_method', length: 10 })
  codeChallengeMethod: string;

  @Column({ type: 'text', nullable: true })
  nonce?: string | null;

  @Column({ type: 'text', nullable: true })
  state?: string | null;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'used_at', type: 'timestamptz', nullable: true })
  usedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
