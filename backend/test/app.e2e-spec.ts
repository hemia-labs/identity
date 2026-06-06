import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from '../src/app.bootstrap';

describe('Health (e2e)', () => {
  let app: INestApplication<App>;

  jest.setTimeout(30000);

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.PORT = '3000';
    process.env.APP_CORS_ORIGINS = 'http://localhost:5173';
    process.env.DB_HOST = process.env.DB_HOST ?? 'localhost';
    process.env.DB_PORT = process.env.DB_PORT ?? '5432';
    process.env.DB_USERNAME = process.env.DB_USERNAME ?? 'hemia';
    process.env.DB_PASSWORD = process.env.DB_PASSWORD ?? 'hemia';
    process.env.DB_DATABASE = process.env.DB_DATABASE ?? 'hemia_id';
    process.env.DB_RETRY_ATTEMPTS = '1';
    process.env.DB_RETRY_DELAY = '500';
    process.env.REDIS_HOST = process.env.REDIS_HOST ?? 'localhost';
    process.env.REDIS_PORT = process.env.REDIS_PORT ?? '6379';
    process.env.JWT_ACCESS_SECRET =
      process.env.JWT_ACCESS_SECRET ?? 'test_access_secret_change_me_32_chars';
    process.env.JWT_REFRESH_SECRET =
      process.env.JWT_REFRESH_SECRET ??
      'test_refresh_secret_change_me_32_chars';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  it('/api/v1/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe('ok');
        expect(body.service).toBe('hemia-id-backend');
      });
  });

  it('/api/v1/health/db (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/v1/health/db')
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe('ok');
        expect(body.dependency).toBe('postgres');
      });
  });

  it('/api/v1/health/redis (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/v1/health/redis')
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe('ok');
        expect(body.dependency).toBe('redis');
      });
  });

  it('returns Nest default errors for 404', () => {
    return request(app.getHttpServer())
      .get('/api/v1/missing')
      .expect(404)
      .expect(({ body }) => {
        expect(body.statusCode).toBe(404);
        expect(body.error).toBe('Not Found');
      });
  });

  afterAll(async () => {
    await app?.close();
  });
});
