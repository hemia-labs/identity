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
  InvitationAccepted = 'invitation.accepted',
  TeamMemberAdded = 'team.member.added',
  TeamMemberRemoved = 'team.member.removed',
  OrgMemberAdded = 'org.member.added',
  OrgMemberRemoved = 'org.member.removed',
}

@Entity('identity_events')
@Index('IDX_identity_events_type', ['type'])
@Index('IDX_identity_events_created_at', ['createdAt'])
@Index('IDX_identity_events_tenant_id', ['tenantId'])
export class IdentityEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: IdentityEventType })
  type: IdentityEventType;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId?: string | null;

  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organizationId?: string | null;

  @Column({ name: 'team_id', type: 'uuid', nullable: true })
  teamId?: string | null;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId?: string | null;

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
