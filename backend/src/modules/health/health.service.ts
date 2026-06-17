import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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

  private getErrorDetails(error: unknown) {
    if (error instanceof Error) {
      return { message: error.message };
    }

    return {};
  }
}
