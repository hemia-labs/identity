import { ForbiddenException, Injectable } from '@nestjs/common';
import { DataSource, IsNull } from 'typeorm';
import { UserEntity, UserStatus } from '../users/entities/user.entity';
import { ExternalAccountProvider } from './entities/external-account-provider.enum';
import { ExternalAccountEntity } from './entities/external-account.entity';
import { GoogleUserInput } from './types/google-user-input.type';
import { SessionEntity } from '../sessions/entities/session.entity';
import { OAuthTokenEntity } from '../oauth/entities/oauth-token.entity';
import { IdentityEventEntity, IdentityEventType } from '../identity-events/entities/identity-event.entity';

@Injectable()
export class ExternalAccountsService {
  constructor(private readonly dataSource: DataSource) {}

  async findOrCreateGoogleUser(input: GoogleUserInput, invitationEmail?: string, invitationIssuedAt?: string): Promise<UserEntity> {
    if (!input.emailVerified) {
      throw new ForbiddenException('Google email must be verified');
    }

    const email = input.email.trim().toLowerCase();

    return this.dataSource.transaction(async (manager) => {
      const externalAccountsRepository = manager.getRepository(
        ExternalAccountEntity,
      );
      const usersRepository = manager.getRepository(UserEntity);

      const existingAccount = await externalAccountsRepository.findOne({
        where: {
          provider: ExternalAccountProvider.Google,
          providerAccountId: input.googleId,
          deletedAt: IsNull(),
        },
        relations: { user: true },
      });

      if (existingAccount) {
        if (invitationEmail === email && (
          !existingAccount.user || existingAccount.user.deletedAt || existingAccount.user.status === UserStatus.Deleted
        )) {
          const user = await usersRepository.findOne({
            where: { id: existingAccount.userId },
            withDeleted: true,
            lock: { mode: 'pessimistic_write' },
          });
          if (user && user.email === email && (
            user.status === UserStatus.Deleted || (user.deletedAt && user.status === UserStatus.Active)
          )) {
            if (!user.deletedAt || !invitationIssuedAt || !(
              Date.parse(invitationIssuedAt) > user.deletedAt.getTime()
            )) {
              throw new ForbiddenException('GOOGLE_USER_NOT_FOUND');
            }
            // A replacement account must never be merged into the deleted identity.
            const replacement = await usersRepository.findOne({ where: { email, deletedAt: IsNull() } });
            if (replacement && replacement.id !== user.id) {
              throw new ForbiddenException('GOOGLE_ACCOUNT_LINK_REQUIRED');
            }
            await manager.getRepository(SessionEntity).update(
              { userId: user.id, isActive: true },
              { isActive: false, revokedAt: new Date() },
            );
            await manager.getRepository(OAuthTokenEntity).update(
              { userId: user.id, revokedAt: IsNull() },
              { revokedAt: new Date() },
            );
            user.status = UserStatus.Active;
            user.deletedAt = null;
            user.lockedAt = null;
            user.emailVerified = true;
            const restored = await usersRepository.save(user);
            await manager.getRepository(IdentityEventEntity).save({
              type: IdentityEventType.UserUpdated,
              userId: restored.id,
              payload: {
                operation: 'invitation_reactivation',
                user: {
                  sub: restored.id, email: restored.email,
                  name: `${restored.firstName} ${restored.lastName}`.trim(),
                  firstName: restored.firstName, lastName: restored.lastName,
                  avatarUrl: restored.avatarUrl, status: 'active', rawStatus: restored.status,
                  createdAt: restored.createdAt, updatedAt: restored.updatedAt, deletedAt: null,
                },
              },
            });
            return restored;
          }
          this.assertActive(user);
          if (user && user.email === email) return user;
          throw new ForbiddenException('GOOGLE_USER_NOT_FOUND');
        }
        this.assertActive(existingAccount.user);
        return existingAccount.user;
      }

      let user = await usersRepository.findOne({
        where: { email, deletedAt: IsNull() },
      });

      if (user) {
        // Matching email alone does not prove ownership of the existing Identity account.
        throw new ForbiddenException('GOOGLE_ACCOUNT_LINK_REQUIRED');
      }

      const { firstName, lastName } = this.splitName(input.name, email);
      user = usersRepository.create({
        email,
        firstName,
        lastName,
        avatarUrl: input.avatarUrl,
        passwordHash: null,
        status: UserStatus.Active,
      });

      user = await usersRepository.save(user);

      await externalAccountsRepository.save(
        externalAccountsRepository.create({
          userId: user.id,
          provider: ExternalAccountProvider.Google,
          providerAccountId: input.googleId,
          email,
          emailVerified: input.emailVerified,
        }),
      );

      return user;
    });
  }

  private assertActive(user: UserEntity | null) {
    if (!user || user.deletedAt || user.status === UserStatus.Deleted) {
      throw new ForbiddenException('GOOGLE_USER_NOT_FOUND');
    }
    if (user.status !== UserStatus.Active) {
      throw new ForbiddenException('User account is not active');
    }
  }

  private splitName(name: string | undefined, email: string) {
    const fallback = email.split('@')[0] || 'Google';
    const parts = (name?.trim() || fallback).split(/\s+/).filter(Boolean);

    return {
      firstName: parts[0]?.slice(0, 100) || 'Google',
      lastName: parts.slice(1).join(' ').slice(0, 100) || 'User',
    };
  }
}
