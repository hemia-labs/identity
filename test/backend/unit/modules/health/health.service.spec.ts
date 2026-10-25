import { DataSource } from 'typeorm';
import { HealthService } from '../../../../../backend/src/modules/health/health.service';

describe('HealthService', () => {
  it('reports pending migrations', async () => {
    const dataSource = {
      query: jest.fn(),
      showMigrations: jest.fn().mockResolvedValue(true),
    } as unknown as DataSource;
    const service = new HealthService(dataSource);

    await expect(service.ready()).resolves.toEqual({
      status: 'not_ready',
      reason: 'pending_migrations',
    });
  });
});
