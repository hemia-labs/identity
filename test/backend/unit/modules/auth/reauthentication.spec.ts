import {
  ForbiddenException,
  HttpException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import argon2 from 'argon2';
import { DataSource } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ReauthenticationService } from '../../../../../backend/src/modules/auth/reauthentication/reauthentication.service';
import {
  ReauthenticateDto,
  WEBHOOK_PAYLOAD_PURPOSE,
} from '../../../../../backend/src/modules/auth/reauthentication/reauthenticate.dto';
import { OAuthTokenEntity } from '../../../../../backend/src/modules/oauth/entities/oauth-token.entity';
import { OAuthClientEntity } from '../../../../../backend/src/modules/oauth/entities/oauth-client.entity';
import { SessionEntity } from '../../../../../backend/src/modules/sessions/entities/session.entity';
import { UserEntity } from '../../../../../backend/src/modules/users/entities/user.entity';
import { IdentityEventType } from '../../../../../backend/src/modules/identity-events/entities/identity-event.entity';

const dto: ReauthenticateDto = {
  password: 'correct-password',
  purpose: WEBHOOK_PAYLOAD_PURPOSE,
};
function fixture(
  options: {
    token?: object | null;
    client?: object | null;
    session?: object | null;
    user?: object | null;
    attempts?: string;
    locked?: boolean;
  } = {},
) {
  const defaults = {
    token: {
      userId: 'subject-from-token',
      sessionId: 'session-id',
      clientId: 'billing',
      scope: 'openid billing.access',
    },
    client: { clientId: 'billing', status: 'active' },
    session: { id: 'session-id', userId: 'subject-from-token' },
    user: {
      id: 'subject-from-token',
      status: 'active',
      passwordHash: 'stored-hash',
    },
  };
  const values = { ...defaults, ...options };
  const entities = new Map<unknown, object | null | undefined>([
    [OAuthTokenEntity, values.token],
    [OAuthClientEntity, values.client],
    [SessionEntity, values.session],
    [UserEntity, values.user],
  ]);
  const manager = {
    findOne: jest.fn((entity: unknown) =>
      Promise.resolve(entities.get(entity)),
    ),
    query: jest.fn((sql: string) =>
      Promise.resolve(
        sql.includes('pg_try_advisory')
          ? [{ acquired: options.locked !== false }]
          : [{ attempts: options.attempts ?? '0' }],
      ),
    ),
    create: jest.fn((_entity: unknown, value: object) => value),
    save: jest.fn().mockResolvedValue({}),
  };
  const transaction = jest.fn(
    async (callback: (manager: unknown) => Promise<unknown>) =>
      callback(manager),
  );
  return {
    service: new ReauthenticationService({
      transaction,
    } as unknown as DataSource),
    manager,
    transaction,
  };
}

describe('ReauthenticationService', () => {
  beforeEach(() => {
    jest.spyOn(argon2, 'verify').mockResolvedValue(true);
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('verifies the password for the token subject without issuing tokens or sessions', async () => {
    const { service, manager } = fixture();
    await expect(
      service.reauthenticate('Bearer oauth-user-token', dto),
    ).resolves.toEqual({
      verified: true,
      subject: 'subject-from-token',
      purpose: WEBHOOK_PAYLOAD_PURPOSE,
    });
    expect(argon2.verify).toHaveBeenCalledWith(
      'stored-hash',
      'correct-password',
    );
    expect(manager.findOne).toHaveBeenCalledWith(
      UserEntity,
      expect.objectContaining({
        where: { id: 'subject-from-token' },
        select: { id: true, status: true, passwordHash: true },
      }),
    );
    expect(manager.save).toHaveBeenCalledTimes(1);
    expect(manager.save).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: IdentityEventType.LoginSucceeded,
        userId: 'subject-from-token',
        payload: {
          operation: 'reauthentication',
          purpose: WEBHOOK_PAYLOAD_PURPOSE,
          clientId: 'billing',
          sessionId: 'session-id',
        },
      }),
    );
    expect(JSON.stringify(manager.save.mock.calls)).not.toContain(dto.password);
    expect(JSON.stringify(manager.save.mock.calls)).not.toContain(
      'oauth-user-token',
    );
  });

  it('commits the failed verification event before rejecting the password', async () => {
    jest.mocked(argon2.verify).mockResolvedValue(false);
    const { service, manager, transaction } = fixture();
    await expect(
      service.reauthenticate('Bearer token', dto),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(transaction.mock.results[0].value).resolves.toMatchObject({
      verified: false,
    });
    expect(manager.save).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: IdentityEventType.LoginFailed }),
    );
  });

  it('rejects missing bearer tokens without touching the database', async () => {
    const { service, transaction } = fixture();
    await expect(service.reauthenticate(undefined, dto)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(transaction).not.toHaveBeenCalled();
  });

  it.each([null, { clientId: 'machine', scope: 'openid billing.access' }])(
    'rejects absent or machine tokens',
    async (token) => {
      const { service, manager } = fixture({ token });
      await expect(
        service.reauthenticate('Bearer token', dto),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(argon2.verify).not.toHaveBeenCalled();
      expect(manager.save).not.toHaveBeenCalled();
    },
  );

  it.each([
    { client: null },
    { session: null },
    { user: { id: 'subject-from-token', status: 'locked' } },
  ])('rejects inactive clients, sessions or users', async (options) => {
    const { service } = fixture(options);
    await expect(
      service.reauthenticate('Bearer token', dto),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(argon2.verify).not.toHaveBeenCalled();
  });

  it('rejects users without a local password and records the attempt', async () => {
    const { service, manager } = fixture({
      user: { id: 'subject-from-token', status: 'active', passwordHash: null },
    });
    await expect(
      service.reauthenticate('Bearer token', dto),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(argon2.verify).not.toHaveBeenCalled();
    expect(manager.save).toHaveBeenCalled();
  });

  it('rejects a different purpose before checking the password', async () => {
    const { service, transaction } = fixture();
    await expect(
      service.reauthenticate('Bearer token', {
        ...dto,
        purpose: 'other' as typeof WEBHOOK_PAYLOAD_PURPOSE,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('rejects tokens without the Billing user scope', async () => {
    const { service } = fixture({
      token: {
        userId: 'user',
        sessionId: 'session',
        clientId: 'other',
        scope: 'openid',
      },
    });
    await expect(
      service.reauthenticate('Bearer token', dto),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(argon2.verify).not.toHaveBeenCalled();
  });

  it.each([{ attempts: '5' }, { locked: false }])(
    'limits repeated and concurrent attempts before password hashing',
    async (options) => {
      const { service } = fixture(options);
      try {
        await service.reauthenticate('Bearer token', dto);
        throw new Error('Expected rejection');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getStatus()).toBe(429);
      }
      expect(argon2.verify).not.toHaveBeenCalled();
    },
  );

  it('shares the persistent limiter across clients by token subject', async () => {
    const { service, manager } = fixture();
    await service.reauthenticate('Bearer token', dto);
    expect(manager.query).toHaveBeenCalledWith(
      expect.stringContaining('pg_try_advisory_xact_lock'),
      ['identity:reauthentication:subject-from-token'],
    );
    expect(manager.query).toHaveBeenCalledWith(
      expect.stringContaining("interval '15 minutes'"),
      [
        'subject-from-token',
        IdentityEventType.LoginSucceeded,
        IdentityEventType.LoginFailed,
      ],
    );
  });

  it('fails closed on database or password verifier failures', async () => {
    const first = fixture();
    first.transaction.mockRejectedValue(new Error('database down'));
    await expect(
      first.service.reauthenticate('Bearer token', dto),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    jest.mocked(argon2.verify).mockRejectedValue(new Error('malformed hash'));
    await expect(
      fixture().service.reauthenticate('Bearer token', dto),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('validates password length and purpose at the HTTP boundary', async () => {
    expect(
      await validate(
        plainToInstance(ReauthenticateDto, {
          ...dto,
          password: 'a'.repeat(1024),
        }),
      ),
    ).toHaveLength(0);
    expect(
      await validate(
        plainToInstance(ReauthenticateDto, {
          ...dto,
          password: 'a'.repeat(1025),
        }),
      ),
    ).toHaveLength(1);
    expect(
      await validate(plainToInstance(ReauthenticateDto, dto)),
    ).toHaveLength(0);
    expect(
      await validate(
        plainToInstance(ReauthenticateDto, { password: '', purpose: 'other' }),
      ),
    ).toHaveLength(2);
  });
});
