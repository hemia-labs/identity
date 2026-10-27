import {
  ExecutionContext,
  ForbiddenException,
  Provider,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import { envValidationSchema } from '../../../../../backend/src/config/env.validation';
import { ExternalAccountsService } from '../../../../../backend/src/modules/external-accounts/external-accounts.service';
import { AuthModule } from '../../../../../backend/src/modules/auth/auth.module';
import { AuthService } from '../../../../../backend/src/modules/auth/auth.service';
import { GoogleAuthGuard } from '../../../../../backend/src/modules/auth/google/google-auth.guard';
import { OAUTH_STATE_COOKIE } from '../../../../../backend/src/modules/auth/constants/auth.constants';
import { GoogleStrategy } from '../../../../../backend/src/modules/auth/google/google.strategy';

const production = {
  NODE_ENV: 'production',
  ID_FRONTEND_URL: 'https://id.example.test',
  ACCESS_API_URL: 'https://access.example.test',
  ACCESS_JWKS_URI: 'https://access.example.test/.well-known/jwks.json',
  SMTP_HOST: 'smtp.example.test',
  SMTP_USER: 'test',
  SMTP_PASS: 'test',
  JWT_ACCESS_SECRET: 'a'.repeat(64),
  JWT_REFRESH_SECRET: 'b'.repeat(64),
  OAUTH_STATE_SECRET: 'c'.repeat(64),
};

const googleProvider = (
  Reflect.getMetadata(MODULE_METADATA.PROVIDERS, AuthModule) as Provider[]
).find(
  (provider) =>
    typeof provider === 'object' &&
    'provide' in provider &&
    provider.provide === GoogleStrategy,
)!;

async function createStrategy(credentials: Record<string, string>) {
  const config = new ConfigService(credentials);
  const module = await Test.createTestingModule({
    providers: [
      googleProvider,
      { provide: ConfigService, useValue: config },
      { provide: ExternalAccountsService, useValue: {} },
    ],
  }).compile();
  return {
    module,
    strategy: module.get<GoogleStrategy | null>(GoogleStrategy),
  };
}

describe('Optional Google authentication', () => {
  it('accepts production without Google credentials or with both empty', () => {
    expect(envValidationSchema.validate(production).error).toBeUndefined();
    expect(
      envValidationSchema.validate({
        ...production,
        GOOGLE_CLIENT_ID: '',
        GOOGLE_CLIENT_SECRET: '',
      }).error,
    ).toBeUndefined();
  });

  it.each([
    { GOOGLE_CLIENT_ID: 'configured' },
    { GOOGLE_CLIENT_SECRET: 'configured' },
    {
      GOOGLE_CLIENT_ID: 'configured',
      GOOGLE_CLIENT_SECRET: 'dummy_google_client_secret',
    },
  ])(
    'rejects incomplete or placeholder Google credentials: %p',
    (credentials) => {
      expect(
        envValidationSchema.validate({ ...production, ...credentials }).error,
      ).toBeDefined();
    },
  );

  it('does not instantiate a Passport Google strategy when unconfigured', async () => {
    const { module, strategy } = await createStrategy({});
    expect(strategy).toBeNull();
    await module.close();
  });

  it('keeps the Google strategy available when configured', async () => {
    const { module, strategy } = await createStrategy({
      GOOGLE_CLIENT_ID: 'test-client',
      GOOGLE_CLIENT_SECRET: 'test-secret',
      GOOGLE_CALLBACK_URL:
        'https://id.example.test/api/v1/auth/google/callback',
    });
    expect(strategy).toBeInstanceOf(GoogleStrategy);
    await module.close();
  });

  it('returns an explicit unavailable error before invoking Passport when disabled', () => {
    const guard = new GoogleAuthGuard({} as AuthService, new ConfigService({}));
    expect(() => guard.canActivate({} as ExecutionContext)).toThrow(
      ServiceUnavailableException,
    );
  });
});

describe('Google callback failure redirects', () => {
  afterEach(() => jest.restoreAllMocks());

  const setup = (cookie = 'signed-state') => {
    const response = { redirect: jest.fn(), clearCookie: jest.fn() };
    const request = {
      query: { state: 'signed-state', error: 'access_denied' },
      cookies: { [OAUTH_STATE_COOKIE]: cookie },
    };
    const auth = {
      resolveGoogleRedirectUri: jest
        .fn()
        .mockReturnValue('https://id.example.test/auth/callback'),
    };
    const guard = new GoogleAuthGuard(
      auth as unknown as AuthService,
      new ConfigService({
        GOOGLE_CLIENT_ID: 'id',
        GOOGLE_CLIENT_SECRET: 'secret',
      }),
    );
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as unknown as ExecutionContext;
    return { guard, context, response, auth, request };
  };

  it.each([
    [new Error('cancelled'), 'google_auth_failed'],
    [
      new ForbiddenException('GOOGLE_ACCOUNT_LINK_REQUIRED'),
      'account_link_required',
    ],
  ])(
    'returns a closed error code after validating browser state',
    async (error, code) => {
      jest
        .spyOn(Object.getPrototypeOf(GoogleAuthGuard.prototype), 'canActivate')
        .mockRejectedValue(error);
      const { guard, context, response, auth } = setup();
      await expect(guard.canActivate(context)).resolves.toBe(false);
      expect(auth.resolveGoogleRedirectUri).toHaveBeenCalledWith(
        'signed-state',
      );
      expect(response.redirect).toHaveBeenCalledWith(
        `https://id.example.test/auth/callback?error=${code}`,
      );
    },
  );

  it('does not redirect when browser state does not match', async () => {
    jest
      .spyOn(Object.getPrototypeOf(GoogleAuthGuard.prototype), 'canActivate')
      .mockRejectedValue(new Error('invalid state'));
    const { guard, context, response } = setup('wrong-state');
    await expect(guard.canActivate(context)).rejects.toThrow();
    expect(response.redirect).not.toHaveBeenCalled();
  });
});
