const assert = require('node:assert/strict');
const path = require('node:path');
const { createRequire } = require('node:module');
const { randomUUID } = require('node:crypto');
const backend = path.resolve(__dirname, '../../../backend');
const requireBackend = createRequire(path.join(backend, 'package.json'));
const { DataSource } = requireBackend('typeorm');
const { OAuthClientEntity } = require('../../../backend/dist/src/modules/oauth/entities/oauth-client.entity');
const { OAuthClientsService } = require('../../../backend/dist/src/modules/oauth-clients/oauth-clients.service');
const { OAuthScopesService } = require('../../../backend/dist/src/modules/oauth-scopes/oauth-scopes.service');
const { OAuthApisService } = require('../../../backend/dist/src/modules/oauth-scopes/oauth-apis.service');
const port = Number(process.env.OAUTH_DESTINATION_TEST_PORT);
assert.equal(process.env.IDENTITY_ISOLATED_DATABASE, '1', 'Use postgres.docker.sh');
assert(Number.isInteger(port) && port > 0, 'Disposable database port required');
const db = new DataSource({ type: 'postgres', host: '127.0.0.1', port,
  username: 'postgres', password: 'isolated-test-only', database: 'identity_destinations_test',
  entities: [path.join(backend, 'dist/src/**/*.entity.js')],
  migrations: [path.join(backend, 'dist/src/database/migrations/*.js')],
  synchronize: false, migrationsRun: false });
(async () => {
  await db.initialize();
  try {
    assert.equal((await db.query("SELECT count(*)::int n FROM information_schema.tables WHERE table_schema='public'"))[0].n, 0);
    await db.runMigrations();
    const catalog = new OAuthScopesService(db);
    const apis = new OAuthApisService(db);
    const repository = db.getRepository(OAuthClientEntity);
    const original = await repository.save({ id: randomUUID(), clientId: 'existing-test-client', audience: 'identity-api', type: 'confidential', clientSecretHash: 'existing-test-hash', grantTypes: ['client_credentials'], redirectUris: [], responseTypes: [], scopes: [], requiresConsent: false, status: 'active', serviceDestinations: [{ resource: 'https://identity.example', audience: 'identity-api', scopes: ['identity.tokens.introspect'] }] });
    const registered = await catalog.save({ code: 'notifications.messages.send', name: 'Enviar mensajes', description: 'Synthetic test', enabled: true });
    assert.equal(registered.kind, 'api');
    assert(!('audience' in registered)); assert(!('resource' in registered));
    await assert.rejects(catalog.save({ ...registered, name: 'Duplicate' }), e => e.status === 409);
    const api = await apis.save({ audience: 'notifications-api', resource: 'https://notifications.example/', name: 'Notifications', enabled: true, scopes: [registered.code] });
    assert.equal(api.resource, 'https://notifications.example');
    assert.deepEqual(api.scopes, [registered.code]);
    await assert.rejects(apis.save({ ...api, name: 'Duplicate API' }), e => e.status === 409);
    assert.deepEqual((await repository.findOneByOrFail({ id: original.id })).serviceDestinations, original.serviceDestinations);
    const clients = new OAuthClientsService(repository);
    const dto = { clientId: 'portal-notifications', audience: api.audience, type: 'confidential', grantTypes: ['client_credentials'], responseTypes: [], redirectUris: [], scopes: [], requiresConsent: false, status: 'active', serviceDestinations: [{ resource: api.resource, audience: api.audience, scopes: [registered.code] }] };
    const created = await clients.create(dto);
    assert(created.clientSecret && created.clientSecret.length > 20);
    assert(!('clientSecretHash' in created));
    const saved = await repository.findOneByOrFail({ id: created.id });
    assert(await requireBackend('argon2').verify(saved.clientSecretHash, created.clientSecret));
    assert.deepEqual(saved.serviceDestinations, dto.serviceDestinations);
    assert.deepEqual(saved.scopes, []);
    const list = await clients.findAll();
    assert(!JSON.stringify(list).includes(created.clientSecret));
    assert(!list.some(c => 'clientSecretHash' in c));
    await assert.rejects(clients.create(dto), e => e.status === 409);
    assert((await catalog.list()).some(s => s.code === registered.code));
    console.log('PASS: real migrations, global scope/API catalog, duplicate conflicts, unchanged grants and one-time client secrets');
  } finally { await db.destroy(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
