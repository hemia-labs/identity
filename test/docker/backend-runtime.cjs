// Executed inside the production image; uses no database or application secrets.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

(async () => {
  assert.match(fs.readFileSync('/etc/os-release', 'utf8'), /VERSION_CODENAME=bookworm/);
  assert.match(process.version, /^v22\./);
  assert.equal(process.getuid(), 1000);
  for (const file of ['/usr/local/bin/npm', '/usr/local/bin/yarn', '/usr/local/bin/bun',
                      '/usr/local/include/node']) {
    assert.equal(fs.existsSync(file), false, `Unexpected development tool: ${file}`);
  }
  assert.ok(fs.existsSync('/etc/ssl/certs/ca-certificates.crt'));
  const argon2 = require('argon2');
  const hash = await argon2.hash('isolated-runtime-check');
  assert.equal(await argon2.verify(hash, 'isolated-runtime-check'), true);
  assert.equal(await argon2.verify(hash, 'wrong-password'), false);

  const cli = execFileSync(process.execPath, ['node_modules/typeorm/cli.js', '--help'],
                           { encoding: 'utf8' });
  assert.match(cli, /migration:run/); // Load the operational CLI without executing a migration.
  const { AppDataSource } = require('./dist/data-source');
  assert.equal(AppDataSource.options.synchronize, false);
  assert.notEqual(AppDataSource.options.migrationsRun, true);
  assert.equal(AppDataSource.isInitialized, false);
  assert.ok(fs.readdirSync('dist/src/database/migrations').some(file => file.endsWith('.js')));

  const { MailTemplateManager } = require('./dist/src/modules/mail/mail-template.manager');
  const html = await MailTemplateManager.render(
    '<mjml><mj-body><mj-section><mj-column><mj-text><%= message %></mj-text></mj-column></mj-section></mj-body></mjml>',
    { message: 'Runtime email rendering works' });
  assert.match(html, /Runtime email rendering works/);
  console.log('PASS: Debian/Node, non-root runtime, TLS certificates, Argon2, TypeORM CLI and email rendering');
})().catch(error => { console.error(error); process.exit(1); });
