import { UsersService } from './users.service';
import { UserStatus } from './entities/user.entity';

describe('UsersService', () => {
  it('omits passwordHash from public user responses', () => {
    const service = new UsersService({} as never, {} as never);

    expect(
      service.toPublicUser({
        id: 'user-id',
        email: 'user@hemia.cloud',
        username: 'user',
        passwordHash: 'secret-hash',
        firstName: 'Hemia',
        lastName: 'User',
        avatarUrl: null,
        status: UserStatus.Active,
        lockedAt: null,
        lastLoginAt: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        deletedAt: null,
      }),
    ).not.toHaveProperty('passwordHash');
  });

  it('selects passwordHash only for identifier authentication lookup', async () => {
    const queryBuilder = {
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    };
    const usersRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };
    const service = new UsersService(usersRepository as never, {} as never);

    await service.findByIdentifier('USER@HEMIA.CLOUD');

    expect(queryBuilder.addSelect).toHaveBeenCalledWith('user.passwordHash');
    expect(queryBuilder.where).toHaveBeenCalledWith(
      'user.email = :identifier',
      { identifier: 'user@hemia.cloud' },
    );
    expect(queryBuilder.orWhere).toHaveBeenCalledWith(
      'user.username = :identifier',
      { identifier: 'user@hemia.cloud' },
    );
  });
});
