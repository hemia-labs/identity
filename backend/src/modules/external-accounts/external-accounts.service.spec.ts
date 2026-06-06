import { ForbiddenException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { UserEntity, UserStatus } from '../users/entities/user.entity';
import { ExternalAccountProvider } from './entities/external-account-provider.enum';
import { ExternalAccountEntity } from './entities/external-account.entity';
import { ExternalAccountsService } from './external-accounts.service';

const googleInput = {
  googleId: 'google-123',
  email: 'User@Hemia.Cloud',
  emailVerified: true,
  name: 'User Hemia',
  avatarUrl: 'https://example.com/avatar.png',
};

const activeUser = {
  id: 'user-id',
  email: 'user@hemia.cloud',
  firstName: 'User',
  lastName: 'Hemia',
  status: UserStatus.Active,
} as UserEntity;

const createService = (options: {
  existingAccount?: Partial<ExternalAccountEntity> | null;
  existingUser?: Partial<UserEntity> | null;
}) => {
  const externalAccountsRepository = {
    findOne: jest.fn().mockResolvedValue(options.existingAccount ?? null),
    create: jest.fn((value) => value),
    save: jest.fn((value) => Promise.resolve({ id: 'account-id', ...value })),
  } as unknown as Repository<ExternalAccountEntity>;

  const usersRepository = {
    findOne: jest.fn().mockResolvedValue(options.existingUser ?? null),
    create: jest.fn((value) => value),
    save: jest.fn((value) =>
      Promise.resolve({ id: value.id ?? 'new-user-id', ...value }),
    ),
  } as unknown as Repository<UserEntity>;

  const manager = {
    getRepository: jest.fn((entity) =>
      entity === ExternalAccountEntity
        ? externalAccountsRepository
        : usersRepository,
    ),
  };

  const dataSource = {
    transaction: jest.fn((callback) => callback(manager)),
  } as unknown as DataSource;

  return {
    service: new ExternalAccountsService(dataSource),
    externalAccountsRepository,
    usersRepository,
  };
};

describe('ExternalAccountsService', () => {
  it('rejects Google accounts without verified email', async () => {
    const { service } = createService({});

    await expect(
      service.findOrCreateGoogleUser({ ...googleInput, emailVerified: false }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns existing linked active user', async () => {
    const { service, usersRepository, externalAccountsRepository } =
      createService({
        existingAccount: {
          user: activeUser,
        },
      });

    await expect(service.findOrCreateGoogleUser(googleInput)).resolves.toBe(
      activeUser,
    );
    expect(usersRepository.findOne).not.toHaveBeenCalled();
    expect(externalAccountsRepository.save).not.toHaveBeenCalled();
  });

  it('links Google account to existing active user by verified email', async () => {
    const { service, externalAccountsRepository } = createService({
      existingUser: activeUser,
    });

    await expect(service.findOrCreateGoogleUser(googleInput)).resolves.toMatchObject({
      id: 'user-id',
      email: 'user@hemia.cloud',
    });
    expect(externalAccountsRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: ExternalAccountProvider.Google,
        providerAccountId: 'google-123',
        userId: 'user-id',
      }),
    );
  });

  it('creates active user and Google link when email is new', async () => {
    const { service, usersRepository, externalAccountsRepository } =
      createService({});

    await expect(service.findOrCreateGoogleUser(googleInput)).resolves.toMatchObject({
      email: 'user@hemia.cloud',
      status: UserStatus.Active,
      passwordHash: null,
    });
    expect(usersRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        firstName: 'User',
        lastName: 'Hemia',
        status: UserStatus.Active,
      }),
    );
    expect(externalAccountsRepository.save).toHaveBeenCalled();
  });
});
