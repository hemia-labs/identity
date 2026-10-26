const assert = require('node:assert/strict');
const path = require('node:path');
const { createRequire } = require('node:module');
const backend = path.resolve(__dirname, '../../../backend');
const backendRequire = createRequire(path.join(backend, 'package.json'));
const { DataSource } = backendRequire('typeorm');
const { seedInitialIdentity } = require('../../../backend/dist/src/database/seeds/001-initial-identity');

const port = Number(process.env.SEED_TEST_DATABASE_PORT);
assert(Number.isInteger(port) && port > 0, 'Use the disposable PostgreSQL runner');
const source = new DataSource({
  type: 'postgres',
  host: '127.0.0.1',
  port,
  username: 'postgres',
  password: 'isolated-test-only',
  database: 'identity_seed_test',
  entities: [path.join(backend, 'dist/src/**/*.entity.js')],
  migrations: [path.join(backend, 'dist/src/database/migrations/*.js')],
  synchronize: false,
  migrationsRun: false,
});

const expectedClients = [
  'access-legal-validator', 'balanz-billing-service', 'legal-service-dev',
  'access', 'billing', 'billing-legal-service', 'console',
  'console-access-admin', 'console-identity-admin', 'docs', 'helpdesk', 'legal',
].sort();
const expectedLegalScopes = [
  'openid', 'profile', 'email', 'offline_access', 'legal.access',
  'legal.self.pending.read', 'legal.self.acceptances.create', 'legal.self.acceptances.read',
];

assert.equal(process.env.IDENTITY_ISOLATED_DATABASE, '1', 'Use postgres.docker.sh with a fresh disposable database');
(async () => {
  await source.initialize();
  assert.equal((await source.query("SELECT count(*)::int n FROM information_schema.tables WHERE table_schema='public'"))[0].n, 0, 'Requires a fresh disposable database');
  await source.runMigrations({ transaction: 'all' });
  process.env.NODE_ENV = 'production';
  process.env.SUPER_ADMIN_PASSWORD = 'SyntheticSeedTestPassword2026!';
  process.env.SUPER_ADMIN_EMAIL = 'seed-admin@seed.test';
  process.env.SUPER_ADMIN_USERNAME = 'seed-admin';
  process.env.JWKS_KEY_KID = 'seed-test-key';
  delete process.env.JWKS_PRIVATE_KEY;
  for (const name of expectedClients) {
    process.env[`OAUTH_CLIENT_SECRET_${name.replace(/-/g, '_').toUpperCase()}`] = 'synthetic-seed-client-secret';
  }
  let baseline;
  for (let pass = 1; pass <= 3; pass++) {
    await seedInitialIdentity(source);
    const clients = await source.query('SELECT * FROM oauth_clients ORDER BY client_id');
    assert.deepEqual(clients.map(row => row.client_id), expectedClients, 'Retired clients must never be recreated; docs/helpdesk must remain');
    if (pass === 1) assert.deepEqual(clients.find(row => row.client_id === 'legal').scopes, expectedLegalScopes);
    assert.equal(new Set(expectedLegalScopes).size, 8);
    const stable = {
      clients,
      users: await source.query('SELECT * FROM users ORDER BY id'),
      keys: await source.query('SELECT * FROM jwks_keys ORDER BY id'),
    };
    if (baseline) assert.deepEqual(stable, baseline, 'Rerunning the seed must preserve every user/client field and signing key');
    if (pass === 1) {
      const fs = require('node:fs');
      const expected = JSON.parse(fs.readFileSync(path.join(__dirname, 'seed-clients.expected.json')));
      for (const actual of clients) {
        const configuration = Object.fromEntries(Object.keys(expected[0]).map(key => [key, actual[key]]));
        assert.deepEqual(configuration, expected.find(row => row.client_id === actual.client_id), 'Fresh seed must match current DB configuration');
      }
      await source.query("UPDATE oauth_clients SET audience='custom-api',redirect_uris=ARRAY['https://custom.test/callback'],grant_types=ARRAY['refresh_token'],response_types=ARRAY[]::text[],scopes=ARRAY['custom.scope'],requires_consent=true,status='suspended',client_secret_hash=NULL WHERE client_id='legal'");
      await source.query("UPDATE users SET username='custom-admin',first_name='Custom',email_verified=false,status='locked'");
      process.env.SUPER_ADMIN_PASSWORD = 'DifferentPasswordMustNotReplaceExisting!';
      for (const name of expectedClients) delete process.env[`OAUTH_CLIENT_SECRET_${name.replace(/-/g, '_').toUpperCase()}`];
      baseline = {
        clients: await source.query('SELECT * FROM oauth_clients ORDER BY client_id'),
        users: await source.query('SELECT * FROM users ORDER BY id'),
        keys: stable.keys,
      };
    } else {
      baseline = stable;
      delete process.env.SUPER_ADMIN_PASSWORD;
    }
    console.log(`PASS seed run ${pass}: twelve current clients, docs/helpdesk retained, retired clients absent, existing configuration preserved`);
  }
  console.log('PASS repeated seed preserves all passwords, secrets, configurations, statuses, timestamps and JWKS');
})().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
}).finally(async () => {
  if (source.isInitialized) await source.destroy();
});
