import Joi from 'joi';

const productionSecret = (devDefault: string) =>
  Joi.string().min(32).required().invalid(devDefault);

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().port().default(3000),
  APP_CORS_ORIGINS: Joi.string()
    .allow('')
    .default('http://localhost:5173,http://localhost:3019'),
  APP_ISSUER: Joi.string().uri().default('https://id.hemia.cloud'),
  ID_FRONTEND_URL: Joi.string().uri().required(),
  AUTH_ALLOWED_REDIRECT_URIS: Joi.string()
    .allow('')
    .default('http://localhost:5173/auth/callback'),

  DB_HOST: Joi.string().default('localhost'),
  DB_PORT: Joi.number().port().default(5432),
  DB_USERNAME: Joi.string().default('hemia'),
  DB_PASSWORD: Joi.string().default('hemia'),
  DB_DATABASE: Joi.string().default('hemia_id'),
  DB_SSL: Joi.boolean().truthy('true').falsy('false').default(false),
  DB_LOGGING: Joi.boolean().truthy('true').falsy('false').default(false),
  DB_RETRY_ATTEMPTS: Joi.number().min(0).default(3),
  DB_RETRY_DELAY: Joi.number().min(0).default(3000),

  SMTP_HOST: Joi.string().empty('').optional(),
  SMTP_PORT: Joi.number().port().default(587),
  SMTP_SECURE: Joi.boolean().truthy('true').falsy('false').default(false),
  SMTP_USER: Joi.string().empty('').optional(),
  SMTP_PASS: Joi.string().empty('').optional(),
  EMAIL_FROM_APP: Joi.string().default('Hemia ID'),
  ACCESS_API_URL: Joi.string().uri().required(),
  ACCESS_ISSUER: Joi.string().uri().optional(),
  ACCESS_JWKS_URI: Joi.string().uri().required(),
  ACCESS_AUDIENCE: Joi.string().default('access-api'),

  JWT_ACCESS_SECRET: Joi.string()
    .min(32)
    .when('NODE_ENV', {
      is: 'production',
      then: productionSecret('dev_access_secret_change_me_32_chars'),
      otherwise: Joi.string()
        .min(32)
        .default('dev_access_secret_change_me_32_chars'),
    }),
  JWT_REFRESH_SECRET: Joi.string()
    .min(32)
    .when('NODE_ENV', {
      is: 'production',
      then: productionSecret('dev_refresh_secret_change_me_32_chars'),
      otherwise: Joi.string()
        .min(32)
        .default('dev_refresh_secret_change_me_32_chars'),
    }),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),
  OAUTH_STATE_SECRET: Joi.string()
    .min(32)
    .when('NODE_ENV', {
      is: 'production',
      then: productionSecret('dev_oauth_state_secret_change_me_32_chars'),
      otherwise: Joi.string()
        .min(32)
        .default('dev_oauth_state_secret_change_me_32_chars'),
    }),
  // JWKS_KEY_KID / JWKS_PRIVATE_KEY_PATH are seed-only (app reads the active key from the DB).
  JWKS_PRIVATE_KEY: Joi.string().allow('').default(''),

  GOOGLE_CLIENT_ID: Joi.string().empty('').optional(),
  GOOGLE_CLIENT_SECRET: Joi.string()
    .empty('')
    .optional()
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.string().invalid('dummy_google_client_secret'),
    }),
  GOOGLE_CALLBACK_URL: Joi.string()
    .uri({ allowRelative: false })
    .default('http://localhost:3000/api/v1/auth/google/callback'),

  COOKIE_DOMAIN: Joi.string().allow('').default(''),
  COOKIE_SECURE: Joi.boolean().truthy('true').falsy('false').default(false),
  COOKIE_SAME_SITE: Joi.string().valid('strict', 'lax', 'none').default('lax'),
  COOKIE_ACCESS_TOKEN_MAX_AGE_SECONDS: Joi.number().min(60).default(900),
  COOKIE_REFRESH_TOKEN_MAX_AGE_SECONDS: Joi.number().min(60).default(2592000),
})
  .and('GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET')
  .and('SMTP_HOST', 'SMTP_USER', 'SMTP_PASS');
