import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import argon2 from 'argon2';
import { RefreshTokensService } from '../../../../../backend/src/modules/refresh-tokens/refresh-tokens.service';
import { SessionsService } from '../../../../../backend/src/modules/sessions/sessions.service';
import {
  UserEntity,
  UserStatus,
} from '../../../../../backend/src/modules/users/entities/user.entity';
import { UsersService } from '../../../../../backend/src/modules/users/users.service';
import { AuthService } from '../../../../../backend/src/modules/auth/auth.service';

const createService = (user: Partial<UserEntity> | null) => {
  const configService = {
    get: jest.fn((key: string, fallback?: string) => {
      const values: Record<string, string> = {
        'jwt.refreshExpiresIn': '30d',
        'jwt.accessExpiresIn': '15m',
        AUTH_ALLOWED_REDIRECT_URIS: 'http://localhost:5173/auth/callback',
      };
      return values[key] ?? fallback;
    }),
    getOrThrow: jest.fn(() => 'test_secret_with_at_least_32_characters'),
  } as unknown as ConfigService;
  const jwtService = {
    sign: jest.fn().mockReturnValue('oauth-state'),
    verify: jest.fn().mockReturnValue({
      purpose: 'google_login_redirect',
      redirectUri: 'http://localhost:5173/auth/callback',
    }),
    signAsync: jest.fn().mockResolvedValue('access-token'),
  } as unknown as JwtService;
  const usersService = {
    findByIdentifier: jest.fn().mockResolvedValue(user),
  } as unknown as UsersService;
  const sessionsService = {
    create: jest.fn().mockResolvedValue({
      id: 'session-id',
      sessionFamilyId: 'family-id',
      expiresAt: new Date('2030-01-01T00:00:00.000Z'),
    }),
  } as unknown as SessionsService;
  const refreshTokensService = {
    create: jest.fn(),
  } as unknown as RefreshTokensService;

  return new AuthService(
    configService,
    jwtService,
    usersService,
    sessionsService,
    refreshTokensService,
  );
};

describe('AuthService', () => {
  beforeEach(() => {
    jest.spyOn(argon2, 'verify').mockResolvedValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('logs in an active user with email or username', async () => {
    const service = createService({
      id: 'user-id',
      email: 'user@hemia.cloud',
      username: 'user',
      passwordHash: 'hash',
      firstName: 'User',
      lastName: 'Hemia',
      status: UserStatus.Active,
    });

    await expect(
      service.login(
        { identifier: 'user@hemia.cloud', password: 'password123' },
        {},
      ),
    ).resolves.toMatchObject({
      accessToken: 'access-token',
      session: {
        user: {
          email: 'user@hemia.cloud',
        },
      },
    });
  });

  it('rejects locked users', async () => {
    const service = createService({
      id: 'user-id',
      email: 'user@hemia.cloud',
      passwordHash: 'hash',
      firstName: 'User',
      lastName: 'Hemia',
      status: UserStatus.Locked,
    });

    await expect(
      service.login(
        { identifier: 'user@hemia.cloud', password: 'password123' },
        {},
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('creates Google OAuth state for allowed redirect URI', () => {
    const service = createService(null);

    expect(
      service.createGoogleOAuthState('http://localhost:5173/auth/callback'),
    ).toBe('oauth-state');
  });

  it('rejects Google OAuth state for disallowed redirect URI', () => {
    const service = createService(null);

    expect(() =>
      service.createGoogleOAuthState('http://evil.test/auth/callback'),
    ).toThrow('redirect_uri is not allowed');
  });

  it('resolves Google OAuth state to redirect URI', () => {
    const service = createService(null);

    expect(service.resolveGoogleRedirectUri('oauth-state')).toBe(
      'http://localhost:5173/auth/callback',
    );
  });
});
