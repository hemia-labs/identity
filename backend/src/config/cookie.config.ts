import { registerAs } from '@nestjs/config';

export default registerAs('cookie', () => ({
  domain: process.env.COOKIE_DOMAIN || undefined,
  secure: process.env.COOKIE_SECURE === 'true',
  sameSite: process.env.COOKIE_SAME_SITE ?? 'lax',
  accessTokenMaxAgeSeconds: Number(
    process.env.COOKIE_ACCESS_TOKEN_MAX_AGE_SECONDS ?? 900,
  ),
  refreshTokenMaxAgeSeconds: Number(
    process.env.COOKIE_REFRESH_TOKEN_MAX_AGE_SECONDS ?? 2_592_000,
  ),
}));
