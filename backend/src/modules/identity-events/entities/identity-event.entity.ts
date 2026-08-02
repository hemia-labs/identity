import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum IdentityEventType {
  UserCreated = 'user.created',
  UserUpdated = 'user.updated',
  UserSuspended = 'user.suspended',
  UserDeleted = 'user.deleted',
  LoginSucceeded = 'auth.login_succeeded',
  LoginFailed = 'auth.login_failed',
  TokenIssued = 'auth.token_issued',
  SessionRevoked = 'auth.session_revoked',
}

@Entity('identity_events')
@Index('IDX_identity_events_type', ['type'])
@Index('IDX_identity_events_created_at', ['createdAt'])
export class IdentityEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: IdentityEventType })
  type: IdentityEventType;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId?: string | null;

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
