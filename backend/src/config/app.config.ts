import { registerAs } from '@nestjs/config';

const parseOrigins = (value?: string) =>
  (value ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

export default registerAs('app', () => ({
  env: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3000),
  corsOrigins: parseOrigins(process.env.APP_CORS_ORIGINS),
  issuer: process.env.APP_ISSUER ?? 'https://id.hemia.cloud',
  frontendUrl: process.env.ID_FRONTEND_URL,
}));
