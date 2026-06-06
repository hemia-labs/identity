import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserEntity } from '../../users/entities/user.entity';
import { ExternalAccountProvider } from './external-account-provider.enum';

@Entity('external_accounts')
@Index(
  'IDX_external_accounts_provider_account_active_unique',
  ['provider', 'providerAccountId'],
  {
    unique: true,
    where: '"deleted_at" IS NULL',
  },
)
@Index('IDX_external_accounts_user_id', ['userId'])
export class ExternalAccountEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => UserEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @Column({ type: 'enum', enum: ExternalAccountProvider })
  provider: ExternalAccountProvider;

  @Column({ name: 'provider_account_id', length: 255 })
  providerAccountId: string;

  @Column({ length: 320 })
  email: string;

  @Column({ name: 'email_verified', type: 'boolean', default: false })
  emailVerified: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt?: Date | null;
}
