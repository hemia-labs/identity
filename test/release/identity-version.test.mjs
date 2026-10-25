import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { identityChangeset, isIdentityVersionBatch } from '../../scripts/identity-version.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const note = '---\n"backend": major\n---\nFirst application release.\n';
const files = ['backend/package.json', 'frontend/package.json', 'backend/CHANGELOG.md',
  'frontend/CHANGELOG.md', 'bun.lock', '.changeset/app.md'];
const removed = [{ path: '.changeset/app.md', source: note }];
const before = { backend: '0.0.1', frontend: '0.0.1' };
const after = { backend: '1.0.0', frontend: '1.0.0' };

test('only a complete application version batch publishes', () => {
  assert(isIdentityVersionBatch(before, after, files, removed));
  assert.equal(isIdentityVersionBatch(before, before, files, removed), false);
  assert.equal(isIdentityVersionBatch(before, after, [...files, 'backend/src/main.ts'], removed), false);
  assert.equal(isIdentityVersionBatch(before, after, files.slice(1), removed), false);
  assert.equal(isIdentityVersionBatch(before, after, files, []), false);
  assert.equal(isIdentityVersionBatch(before, after, files, [{ ...removed[0], source: '---\n"@hemia/auth": patch\n---\nSDK\n' }]), false);
  assert.throws(() => isIdentityVersionBatch(after, before, files, removed), /must increase/);
  assert.throws(() => isIdentityVersionBatch(before, { ...after, frontend: '1.1.0' }, files, removed), /share a version/);
  assert(identityChangeset(note));
  assert.equal(identityChangeset('---\n"backend": minor\n"@hemia/auth": minor\n---\nMixed\n'), false);
});

for (const target of ['identity', 'auth']) {
  test(`real Changesets versions ${target} without consuming the other release`, () => {
    const dir = mkdtempSync(join(tmpdir(), 'identity-version-'));
    try {
      for (const directory of ['backend', 'frontend', 'packages/auth', '.changeset', 'scripts', 'bin']) {
        mkdirSync(join(dir, directory), { recursive: true });
      }
      for (const path of ['package.json', 'bun.lock', 'backend/package.json', 'frontend/package.json',
        'packages/auth/package.json', '.changeset/config.json', 'scripts/version-identity.mjs', 'scripts/version-auth.mjs']) {
        copyFileSync(join(root, path), join(dir, path));
      }
      symlinkSync(join(root, 'node_modules'), join(dir, 'node_modules'), 'dir');
      const git = (...args) => execFileSync('git', args, { cwd: dir, stdio: 'pipe' });
      git('init', '-q', '-b', 'fixture'); git('add', '.');
      git('-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-qm', 'fixture');
      git('update-ref', 'refs/remotes/origin/develop', 'HEAD');
      if (target === 'auth') git('branch', 'develop');
      writeFileSync(join(dir, '.changeset/app.md'), note);
      writeFileSync(join(dir, '.changeset/sdk.md'), '---\n"@hemia/auth": patch\n---\nSDK fix.\n');
      git('add', '.changeset');
      git('-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-qm', 'merge pending changesets');
      if (target === 'identity') {
        git('update-ref', 'refs/remotes/origin/main', 'HEAD');
        const workflow = readFileSync(join(root, '.github/workflows/identity-release.yml'), 'utf8');
        const base = workflow.match(/^          (git branch develop origin\/develop)$/m)?.[1];
        assert(base, 'Main checkout must prepare the configured Changesets base branch');
        git(...base.split(' ').slice(1));
        const command = workflow.match(/bun run changeset (status[^\n]+)/)[1];
        const output = join(dir, 'status.json');
        const args = command.replace('"$RUNNER_TEMP/identity-status.json"', output).split(' ');
        execFileSync(process.execPath, [join(dir, 'node_modules/@changesets/cli/bin.js'), ...args], { cwd: dir, stdio: 'pipe' });
        const status = JSON.parse(readFileSync(output));
        assert(status.releases.some(r => r.name === 'backend'), 'Already merged app changesets must remain pending');
        assert(status.releases.some(r => r.name === 'frontend'));
      }
      // Keep the installed dependency tree read-only; frozen installation runs in the full check suite.
      writeFileSync(join(dir, 'bin/bun'), '#!/bin/sh\ntest "$*" = "install --frozen-lockfile"\n', { mode: 0o755 });
      const version = name => JSON.parse(readFileSync(join(dir, name, 'package.json'))).version;
      const sdkBefore = version('packages/auth');
      const appBefore = version('backend');
      const nextMajor = `${Number(appBefore.split('.')[0]) + 1}.0.0`;
      execFileSync(process.execPath, [join(dir, `scripts/version-${target}.mjs`)], {
        cwd: dir, env: { ...process.env, PATH: `${join(dir, 'bin')}:${process.env.PATH}` }, stdio: 'pipe',
      });
      const appVersion = target === 'identity' ? nextMajor : appBefore;
      assert.equal(version('backend'), appVersion);
      assert.equal(version('frontend'), appVersion);
      assert.equal(version('packages/auth') === sdkBefore, target === 'identity');
      assert.equal(readFileSync(join(dir, '.changeset', target === 'identity' ? 'sdk.md' : 'app.md'), 'utf8').includes('---'), true);
      const lock = readFileSync(join(dir, 'bun.lock'), 'utf8');
      for (const name of ['backend', 'frontend', 'packages/auth']) {
        const entry = lock.split(`"${name}": {`)[1].split('}')[0];
        assert(entry.includes(`"version": "${version(name)}"`));
      }
      if (target === 'identity') {
        assert(readFileSync(join(dir, 'backend/CHANGELOG.md'), 'utf8').includes(`## ${appVersion}`));
        assert(readFileSync(join(dir, 'frontend/CHANGELOG.md'), 'utf8').includes(`## ${appVersion}`));
      }
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
}
