import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum JwksKeyStatus {
  Active = 'active',
  Rotated = 'rotated',
  Revoked = 'revoked',
}

@Entity('jwks_keys')
@Index('IDX_jwks_keys_kid', ['kid'], { unique: true })
export class JwksKeyEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 80 })
  kid: string;

  @Column({ length: 20, default: 'RS256' })
  alg: string;

  @Column({ name: 'public_key', type: 'text' })
  publicKey: string;

  @Column({ name: 'private_key_encrypted', type: 'text' })
  privateKeyEncrypted: string;

  @Column({ type: 'enum', enum: JwksKeyStatus, default: JwksKeyStatus.Active })
  status: JwksKeyStatus;

  @Column({ name: 'rotated_at', type: 'timestamptz', nullable: true })
  rotatedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
