import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { HealthService } from './health.service';

describe('HealthService', () => {
  it('returns app health status', () => {
    const dataSource = { query: jest.fn() } as unknown as DataSource;
    const configService = {
      get: jest.fn((key: string) => (key === 'app.env' ? 'test' : undefined)),
    } as unknown as ConfigService;
    const service = new HealthService(dataSource, configService);

    expect(service.getHealth()).toEqual({
      status: 'ok',
      service: 'hemia-id-backend',
      environment: 'test',
    });
  });
});
