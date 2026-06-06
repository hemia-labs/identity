import path from 'path';
import dotenv from 'dotenv';
import { DataSource } from 'typeorm';

dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local', override: true });

const isProduction = process.env.NODE_ENV === 'production';
const extension = isProduction ? 'js' : 'ts';
const baseDir = isProduction ? 'dist' : 'src';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USERNAME ?? 'hemia',
  password: process.env.DB_PASSWORD ?? 'hemia',
  database: process.env.DB_DATABASE ?? 'hemia_id',
  entities: [path.join(process.cwd(), `${baseDir}/**/*.entity.${extension}`)],
  migrations: [
    path.join(process.cwd(), `${baseDir}/database/migrations/*.${extension}`),
  ],
  synchronize: false,
  logging: process.env.DB_LOGGING === 'true',
  ssl:
    process.env.DB_SSL === 'true'
      ? {
          rejectUnauthorized: false,
        }
      : false,
  extra: {
    options: '-c timezone=America/Mexico_City',
  },
});
