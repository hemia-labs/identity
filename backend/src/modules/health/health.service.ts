import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { DataSource } from 'typeorm';

@Injectable()
export class HealthService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  getHealth() {
    return {
      status: 'ok',
      service: 'hemia-id-backend',
      environment: this.configService.get<string>('app.env'),
    };
  }

  async getDatabaseHealth() {
    try {
      await this.dataSource.query('SELECT 1');

      return {
        status: 'ok',
        dependency: 'postgres',
      };
    } catch (error) {
      throw new ServiceUnavailableException({
        code: 'HEALTH_DB_UNAVAILABLE',
        message: 'Database is unavailable',
        details: this.getErrorDetails(error),
      });
    }
  }

  async getRedisHealth() {
    const redis = new Redis({
      host: this.configService.getOrThrow<string>('redis.host'),
      port: this.configService.getOrThrow<number>('redis.port'),
      password: this.configService.get<string>('redis.password'),
      db: this.configService.get<number>('redis.db', 0),
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });

    try {
      await redis.connect();
      await redis.ping();

      return {
        status: 'ok',
        dependency: 'redis',
      };
    } catch (error) {
      throw new ServiceUnavailableException({
        code: 'HEALTH_REDIS_UNAVAILABLE',
        message: 'Redis is unavailable',
        details: this.getErrorDetails(error),
      });
    } finally {
      redis.disconnect();
    }
  }

  private getErrorDetails(error: unknown) {
    if (error instanceof Error) {
      return { message: error.message };
    }

    return {};
  }
}
