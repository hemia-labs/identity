import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USERNAME ?? 'hemia',
  password: process.env.DB_PASSWORD ?? 'hemia',
  database: process.env.DB_DATABASE ?? 'hemia_id',
  ssl: process.env.DB_SSL === 'true',
  logging: process.env.DB_LOGGING === 'true',
  retryAttempts: Number(process.env.DB_RETRY_ATTEMPTS ?? 3),
  retryDelay: Number(process.env.DB_RETRY_DELAY ?? 3000),
}));
