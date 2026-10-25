import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (directory) => JSON.parse(readFileSync(join(root, directory, 'package.json'), 'utf8')).version;
const before = { backend: read('backend'), frontend: read('frontend'), auth: read('packages/auth') };
assert.equal(before.backend, before.frontend, 'Identity packages must share a version');

execFileSync(process.execPath, [join(root, 'node_modules/@changesets/cli/bin.js'),
  'version', '--ignore', '@hemia/auth'], { cwd: root, stdio: 'inherit' });

const after = { backend: read('backend'), frontend: read('frontend'), auth: read('packages/auth') };
assert.equal(after.backend, after.frontend, 'Identity packages must share a version');
assert.notEqual(after.backend, before.backend, 'No pending Identity changesets');
assert.equal(after.auth, before.auth, 'Identity versioning must not change the SDK');
let lock = readFileSync(join(root, 'bun.lock'), 'utf8');
for (const name of ['backend', 'frontend']) {
  const entry = new RegExp(`("${name}":\\s*\\{\\s*"name":\\s*"${name}",\\s*"version":\\s*")([^\"]+)(")`, 'g');
  const matches = [...lock.matchAll(entry)];
  assert.equal(matches.length, 1, `Expected one ${name} workspace in bun.lock`);
  assert.equal(matches[0][2], before[name], `${name} lockfile version differs`);
  lock = lock.replace(entry, (_match, prefix, _old, suffix) => `${prefix}${after[name]}${suffix}`);
}
writeFileSync(join(root, 'bun.lock'), lock);
execFileSync('bun', ['install', '--frozen-lockfile'], { cwd: root, stdio: 'inherit' });
