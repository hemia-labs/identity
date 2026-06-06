import { ForbiddenException, Injectable } from '@nestjs/common';
import { DataSource, IsNull } from 'typeorm';
import { UserEntity, UserStatus } from '../users/entities/user.entity';
import { ExternalAccountProvider } from './entities/external-account-provider.enum';
import { ExternalAccountEntity } from './entities/external-account.entity';
import { GoogleUserInput } from './types/google-user-input.type';

@Injectable()
export class ExternalAccountsService {
  constructor(private readonly dataSource: DataSource) {}

  async findOrCreateGoogleUser(input: GoogleUserInput): Promise<UserEntity> {
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
        this.assertActive(existingAccount.user);
        return existingAccount.user;
      }

      let user = await usersRepository.findOne({
        where: { email, deletedAt: IsNull() },
      });

      if (user) {
        this.assertActive(user);
        user.avatarUrl = input.avatarUrl ?? user.avatarUrl;
      } else {
        const { firstName, lastName } = this.splitName(input.name, email);
        user = usersRepository.create({
          email,
          firstName,
          lastName,
          avatarUrl: input.avatarUrl,
          passwordHash: null,
          status: UserStatus.Active,
        });
      }

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

  private assertActive(user: UserEntity) {
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
