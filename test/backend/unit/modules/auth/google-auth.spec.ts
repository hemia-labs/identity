import {
  ExecutionContext,
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
