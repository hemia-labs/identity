import { ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  UserEntity,
  UserStatus,
} from '../../../../../backend/src/modules/users/entities/user.entity';
import { ExternalAccountEntity } from '../../../../../backend/src/modules/external-accounts/entities/external-account.entity';
import { ExternalAccountsService } from '../../../../../backend/src/modules/external-accounts/external-accounts.service';
import { SessionEntity } from '../../../../../backend/src/modules/sessions/entities/session.entity';
import { OAuthTokenEntity } from '../../../../../backend/src/modules/oauth/entities/oauth-token.entity';
import { IdentityEventEntity } from '../../../../../backend/src/modules/identity-events/entities/identity-event.entity';

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

  const sessionsRepository = { update: jest.fn() };
  const oauthTokensRepository = { update: jest.fn() };
  const eventsRepository = { save: jest.fn() };
  const manager = {
    getRepository: jest.fn((entity) =>
      entity === ExternalAccountEntity
        ? externalAccountsRepository
        : entity === SessionEntity ? sessionsRepository
        : entity === OAuthTokenEntity ? oauthTokensRepository
        : entity === IdentityEventEntity ? eventsRepository
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
    sessionsRepository,
    oauthTokensRepository,
    eventsRepository,
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

  it.each([
    null,
    { ...activeUser, status: UserStatus.Deleted },
    { ...activeUser, deletedAt: new Date() },
  ])('reports a deleted or missing linked user without creating another account', async (user) => {
    const { service, usersRepository, externalAccountsRepository } = createService({
      existingAccount: { user: user as UserEntity },
    });
    await expect(service.findOrCreateGoogleUser(googleInput)).rejects.toThrow(
      'GOOGLE_USER_NOT_FOUND',
    );
    expect(usersRepository.save).not.toHaveBeenCalled();
    expect(externalAccountsRepository.save).not.toHaveBeenCalled();
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

  it('restores the same deleted Google user for a verified invitation and revokes old sessions', async () => {
    const deleted = { ...activeUser, status: UserStatus.Deleted, deletedAt: new Date() };
    const { service, usersRepository, externalAccountsRepository, sessionsRepository, oauthTokensRepository, eventsRepository } = createService({
      existingAccount: { userId: activeUser.id }, existingUser: deleted,
    });
    usersRepository.findOne.mockResolvedValueOnce(deleted).mockResolvedValueOnce(null);
    await expect(service.findOrCreateGoogleUser(googleInput, activeUser.email, '2030-01-01T00:00:00Z')).resolves.toMatchObject({
      id: activeUser.id, status: UserStatus.Active, deletedAt: null, emailVerified: true,
    });
    expect(usersRepository.findOne).toHaveBeenCalledWith({ where: { id: activeUser.id }, withDeleted: true, lock: { mode: 'pessimistic_write' } });
    expect(sessionsRepository.update).toHaveBeenCalledWith({ userId: activeUser.id, isActive: true }, { isActive: false, revokedAt: expect.any(Date) });
    expect(oauthTokensRepository.update).toHaveBeenCalledWith({ userId: activeUser.id, revokedAt: expect.anything() }, { revokedAt: expect.any(Date) });
    expect(eventsRepository.save).toHaveBeenCalledWith(expect.objectContaining({
      userId: activeUser.id, payload: expect.objectContaining({ operation: 'invitation_reactivation' }),
    }));
    expect(usersRepository.create).not.toHaveBeenCalled();
    expect(externalAccountsRepository.save).not.toHaveBeenCalled();
  });

  it.each([UserStatus.Locked, UserStatus.Inactive])('does not reactivate a %s user through invitations', async status => {
    const { service, usersRepository } = createService({ existingAccount: { user: { ...activeUser, status } } });
    await expect(service.findOrCreateGoogleUser(googleInput, activeUser.email, '2030-01-01T00:00:00Z')).rejects.toThrow('not active');
    expect(usersRepository.save).not.toHaveBeenCalled();
  });

  it('does not recover with an invitation for a different email', async () => {
    const { service, usersRepository } = createService({ existingAccount: { user: { ...activeUser, status: UserStatus.Deleted } } });
    await expect(service.findOrCreateGoogleUser(googleInput, 'other@hemia.cloud')).rejects.toThrow('GOOGLE_USER_NOT_FOUND');
    expect(usersRepository.save).not.toHaveBeenCalled();
  });

  it.each([undefined, 'invalid', '2000-01-01T00:00:00Z'])('rejects invitations issued before deletion or without a signed date: %s', async issuedAt => {
    const deleted = { ...activeUser, status: UserStatus.Deleted, deletedAt: new Date() };
    const { service, usersRepository } = createService({ existingAccount: { userId: activeUser.id }, existingUser: deleted });
    await expect(service.findOrCreateGoogleUser(googleInput, activeUser.email, issuedAt)).rejects.toThrow('GOOGLE_USER_NOT_FOUND');
    expect(usersRepository.save).not.toHaveBeenCalled();
  });

  it('does not merge a replacement account with a deleted identity', async () => {
    const deleted = { ...activeUser, status: UserStatus.Deleted, deletedAt: new Date() };
    const { service, usersRepository, sessionsRepository } = createService({ existingAccount: { userId: activeUser.id }, existingUser: deleted });
    usersRepository.findOne.mockResolvedValueOnce(deleted).mockResolvedValueOnce({ ...activeUser, id: 'replacement' });
    await expect(service.findOrCreateGoogleUser(googleInput, activeUser.email, '2030-01-01T00:00:00Z')).rejects.toThrow('GOOGLE_ACCOUNT_LINK_REQUIRED');
    expect(usersRepository.save).not.toHaveBeenCalled();
    expect(sessionsRepository.update).not.toHaveBeenCalled();
  });
});
