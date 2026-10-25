import type { QueryRunner } from 'typeorm';
import { SubscriptionManagementScope1793062800001 } from '../../../../../backend/src/database/migrations/1793062800001-SubscriptionManagementScope';

test('subscription management registers a catalog definition without assigning grants or replacing administrative configuration', async () => {
  const query = jest
    .fn<Promise<unknown>, [string, unknown[]?]>()
    .mockResolvedValue([]);
  await new SubscriptionManagementScope1793062800001().up({
    query,
  } as unknown as QueryRunner);
  expect(query).toHaveBeenCalledTimes(1);
  const [sql, values] = query.mock.calls[0];
  expect(sql).toContain('INSERT INTO oauth_scopes');
  expect(sql).toContain('count(DISTINCT resource)=1');
  expect(sql).toContain('AND enabled AND resource IS NOT NULL');
  expect(sql).toContain('ON CONFLICT(audience,code) DO NOTHING');
  expect(sql).not.toContain('oauth_clients');
  expect(values).toEqual([
    'billing-api',
    'billing.subscriptions.manage',
    'Gestionar suscripciones',
    'Consultar, cambiar y cancelar las suscripciones del producto autorizado.',
  ]);
});
