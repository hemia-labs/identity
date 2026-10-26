import 'reflect-metadata';
import { assertClientCatalog } from '../../../../../backend/src/modules/oauth-scopes/oauth-catalog-policy';
const destination = {
  audience: 'billing-api',
  resource: 'https://billing',
  scopes: ['billing.read'],
};
const client = {
  audience: 'billing-api',
  scopes: ['openid'],
  serviceDestinations: [destination],
};
function manager() {
  return {
    query: jest.fn((sql: string) =>
      Promise.resolve(
        sql.includes('oauth_apis')
          ? [{ ...destination, enabled: true }]
          : [
              { code: 'openid', kind: 'protocol', enabled: true },
              { code: 'billing.read', kind: 'api', enabled: true },
              { code: 'other.read', kind: 'api', enabled: true },
            ],
      ),
    ),
  };
}
test('a global protocol definition and registered API scopes can be reused', async () => {
  await expect(
    assertClientCatalog(manager() as never, client),
  ).resolves.toBeUndefined();
});
test.each([
  { ...client, scopes: ['unknown'] },
  { ...client, scopes: ['other.read'] },
  { ...client, audience: 'invented-api' },
  { ...client, serviceDestinations: [{ ...destination, scopes: ['openid'] }] },
  {
    ...client,
    serviceDestinations: [{ ...destination, scopes: ['other.read'] }],
  },
  {
    ...client,
    serviceDestinations: [{ ...destination, resource: 'https://other' }],
  },
])('rejects an unknown or cross-API assignment %#', async (value) => {
  await expect(
    assertClientCatalog(manager() as never, value),
  ).rejects.toMatchObject({ status: 400 });
});
test('metadata updates and revocations preserve retired grants without a catalog lookup', async () => {
  const db = manager();
  await assertClientCatalog(
    db as never,
    { ...client, serviceDestinations: [] },
    client,
  );
  expect(db.query).not.toHaveBeenCalled();
});
test('an existing grant does not authorize additions after the API was disabled', async () => {
  const db = { query: jest.fn().mockResolvedValue([]) };
  await expect(
    assertClientCatalog(
      db as never,
      {
        ...client,
        serviceDestinations: [
          { ...destination, scopes: ['billing.read', 'new'] },
        ],
      },
      client,
    ),
  ).rejects.toMatchObject({ status: 400 });
});
