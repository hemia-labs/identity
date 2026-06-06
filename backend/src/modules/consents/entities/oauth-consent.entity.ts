import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('oauth_consents')
@Index('IDX_oauth_consents_user_client', ['userId', 'clientId'])
export class OAuthConsentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'client_id', length: 120 })
  clientId: string;

  @Column({ type: 'text', array: true })
  scopes: string[];

  @Column({ name: 'granted_at', type: 'timestamptz', default: () => 'now()' })
  grantedAt: Date;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt?: Date | null;
}
