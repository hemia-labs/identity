import { ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  UserEntity,
  UserStatus,
} from '../../../../../backend/src/modules/users/entities/user.entity';
import { ExternalAccountEntity } from '../../../../../backend/src/modules/external-accounts/entities/external-account.entity';
import { ExternalAccountsService } from '../../../../../backend/src/modules/external-accounts/external-accounts.service';

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
    create: jest.fn((value: unknown) => value),
    save: jest.fn((value: Partial<ExternalAccountEntity>) =>
      Promise.resolve({ id: 'account-id', ...value }),
    ),
  };

  const usersRepository = {
    findOne: jest.fn().mockResolvedValue(options.existingUser ?? null),
    create: jest.fn((value: Partial<UserEntity>) => value),
    save: jest.fn((value: Partial<UserEntity>) =>
      Promise.resolve({ id: value.id ?? 'new-user-id', ...value }),
    ),
  };

  const manager = {
    getRepository: jest.fn((entity) =>
      entity === ExternalAccountEntity
        ? externalAccountsRepository
        : usersRepository,
    ),
  };

  const dataSource = {
    transaction: jest.fn((callback: (value: typeof manager) => unknown) =>
      callback(manager),
    ),
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

  it('requires explicit linking for an existing email without changing the user', async () => {
    const { service, externalAccountsRepository, usersRepository } =
      createService({
        existingUser: activeUser,
      });
    await expect(service.findOrCreateGoogleUser(googleInput)).rejects.toThrow(
      'GOOGLE_ACCOUNT_LINK_REQUIRED',
    );
    expect(usersRepository.save).not.toHaveBeenCalled();
    expect(externalAccountsRepository.save).not.toHaveBeenCalled();
  });

  it('rejects an inactive linked user', async () => {
    const { service } = createService({
      existingAccount: {
        user: { ...activeUser, status: UserStatus.Inactive },
      },
    });
    await expect(
      service.findOrCreateGoogleUser(googleInput),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('creates active user and Google link when email is new', async () => {
    const { service, usersRepository, externalAccountsRepository } =
      createService({});

    await expect(
      service.findOrCreateGoogleUser(googleInput),
    ).resolves.toMatchObject({
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
