import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const packageDir = join(root, 'packages/auth');
const manifest = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8'));
const temporary = mkdtempSync(join(tmpdir(), 'hemia-auth-pack-'));
const run = (command, args, cwd) => execFileSync(command, args, {
  cwd,
  encoding: 'utf8',
  env: { ...process.env, npm_config_cache: join(temporary, 'npm-cache') },
});

try {
  const [packed] = JSON.parse(run('npm', [
    'pack', '--json', '--ignore-scripts', '--pack-destination', temporary,
  ], packageDir));
  assert.equal(packed.name, manifest.name);
  assert.equal(packed.version, manifest.version);
  const files = new Set(packed.files.map(file => file.path));
  for (const entry of Object.values(manifest.exports)) {
    for (const path of Object.values(entry).flatMap(condition => Object.values(condition))) {
      assert(files.has(path.replace(/^\.\//, '')), `Missing export: ${path}`);
    }
  }

  const consumer = join(temporary, 'consumer');
  mkdirSync(consumer);
  writeFileSync(join(consumer, 'package.json'), '{"name":"auth-tarball-smoke","private":true,"type":"module"}\n');
  run('npm', [
    'install', '--ignore-scripts', '--no-audit', '--no-fund', '--no-package-lock',
    join(temporary, packed.filename), '@nestjs/common@10', '@nestjs/core@10', '@sveltejs/kit@2',
  ], consumer);
  writeFileSync(join(consumer, 'check.cjs'), `
const assert = require('node:assert/strict');
const core = require('@hemia/auth');
const nest = require('@hemia/auth/nestjs');
assert.equal(nest.AccessClient, core.AccessClient);
assert.equal(typeof core.SystemContextCache, 'function');
`);
  writeFileSync(join(consumer, 'check.mjs'), `
import assert from 'node:assert/strict';
import { AccessClient, SystemContextCache } from '@hemia/auth';
import { AccessClient as NestAccessClient } from '@hemia/auth/nestjs';
import { createSsoHook } from '@hemia/auth/sveltekit';
assert.equal(NestAccessClient, AccessClient);
assert.equal(typeof SystemContextCache, 'function');
assert.equal(typeof createSsoHook, 'function');
`);
  run(process.execPath, ['check.cjs'], consumer);
  run(process.execPath, ['check.mjs'], consumer);
  if (process.env.AUTH_RELEASE_DIR) {
    const output = resolve(process.env.AUTH_RELEASE_DIR);
    mkdirSync(output, { recursive: true });
    const tarball = join(temporary, packed.filename);
    copyFileSync(tarball, join(output, packed.filename));
    writeFileSync(join(output, 'release.json'), JSON.stringify({
      commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
      name: manifest.name,
      version: manifest.version,
      filename: packed.filename,
      integrity: `sha512-${createHash('sha512').update(readFileSync(tarball)).digest('base64')}`,
    }, null, 2) + '\n');
  }
  console.log(`${manifest.name}@${manifest.version}: tarball and CJS/ESM exports PASS`);
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
