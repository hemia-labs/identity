import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { identityChangeset, isIdentityVersionBatch, retryReleaseTag } from '../../scripts/identity-version.mjs';

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

test('explicit retry requires the exact committed stable version', () => {
  assert.equal(retryReleaseTag('identity-v1.0.0', '1.0.0', '1.0.0'), 'identity-v1.0.0');
  assert.throws(() => retryReleaseTag('identity-v1.0.1', '1.0.0', '1.0.0'), /committed version/);
  assert.throws(() => retryReleaseTag('identity-v1.0.0', '1.0.0', '1.0.1'), /share a version/);
  assert.throws(() => retryReleaseTag('identity-v1.0.0-rc.1', '1.0.0-rc.1', '1.0.0-rc.1'));
  assert.throws(() => retryReleaseTag('identity-v1.0.0\nrelease=true', '1.0.0', '1.0.0'));
});

test('retry CLI emits release outputs only for the committed application version', () => {
  const dir = mkdtempSync(join(tmpdir(), 'identity-retry-'));
  try {
    const output = join(dir, 'output');
    const version = JSON.parse(readFileSync(join(root, 'backend/package.json'))).version;
    const tag = `identity-v${version}`;
    execFileSync(process.execPath, [join(root, 'scripts/identity-version.mjs'), 'retry', tag], {
      cwd: root, env: { ...process.env, GITHUB_OUTPUT: output }, stdio: 'pipe',
    });
    assert.equal(readFileSync(output, 'utf8'), `release=true\ntag=${tag}\n`);
    assert.throws(() => execFileSync(process.execPath,
      [join(root, 'scripts/identity-version.mjs'), 'retry', 'identity-v999999.0.0'], {
        cwd: root, env: { ...process.env, GITHUB_OUTPUT: join(dir, 'invalid') }, stdio: 'pipe',
      }));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

for (const target of ['identity', 'auth']) {
  test(`real Changesets versions ${target} without consuming the other release`, () => {
    const dir = mkdtempSync(join(tmpdir(), 'identity-version-'));
    try {
      for (const directory of ['backend', 'frontend', 'packages/auth', '.changeset', 'scripts', 'bin']) {
        mkdirSync(join(dir, directory), { recursive: true });
      }
      for (const path of ['package.json', 'bun.lock', 'backend/package.json', 'frontend/package.json',
        'packages/auth/package.json', '.changeset/config.json', 'scripts/version-identity.mjs', 'scripts/version-auth.mjs', 'scripts/identity-version.mjs', 'scripts/auth-release.mjs']) {
        copyFileSync(join(root, path), join(dir, path));
      }
      symlinkSync(join(root, 'node_modules'), join(dir, 'node_modules'), 'dir');
      const git = (...args) => execFileSync('git', args, { cwd: dir, stdio: 'pipe' });
      git('init', '-q', '-b', 'main'); git('add', '.');
      git('-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-qm', 'fixture');
      writeFileSync(join(dir, '.changeset/app.md'), note);
      writeFileSync(join(dir, '.changeset/sdk.md'), '---\n"@hemia/auth": patch\n---\nSDK fix.\n');
      git('add', '.changeset');
      git('-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-qm', 'merge pending changesets');
      if (target === 'identity') {
        git('update-ref', 'refs/remotes/origin/main', 'HEAD');
        const workflow = readFileSync(join(root, '.github/workflows/identity-release.yml'), 'utf8');
        const step = workflow.split('      - name: Find pending Identity changesets\n')[1]?.split('\n      - ')[0];
        const command = step?.split('        run: |\n')[1]?.split('\n')
          .map(line => line.replace(/^          /, '')).join('\n').trim();
        assert(command, 'Expected the complete pending changesets workflow step');
        const output = join(dir, 'pending-output');
        execFileSync('bash', ['-e', '-c', command], {
          cwd: dir, env: { ...process.env, GITHUB_OUTPUT: output }, stdio: 'pipe',
        });
        assert.equal(readFileSync(output, 'utf8'), 'pending=true\n');
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
      const pendingOutput = join(dir, 'pending-after-version');
      execFileSync(process.execPath, [join(dir, 'scripts/identity-version.mjs'), 'pending'], {
        cwd: dir, env: { ...process.env, GITHUB_OUTPUT: pendingOutput }, stdio: 'pipe',
      });
      assert.equal(readFileSync(pendingOutput, 'utf8'), `pending=${target === 'auth'}\n`);
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
      const base = git('rev-parse', 'HEAD').toString().trim();
      git('add', 'backend', 'frontend', 'packages/auth', '.changeset', 'bun.lock');
      git('-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-qm', 'reviewed version batch');
      for (const classifier of ['identity', 'auth']) {
        const output = join(dir, `${classifier}-classification`);
        const script = classifier === 'identity' ? 'identity-version.mjs' : 'auth-release.mjs';
        execFileSync(process.execPath, [join(dir, 'scripts', script), 'classify', base], {
          cwd: dir, env: { ...process.env, GITHUB_OUTPUT: output }, stdio: 'pipe',
        });
        assert(readFileSync(output, 'utf8').includes(`release=${classifier === target}\n`));
      }
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
}


test('release notes come from both changelogs without a docs directory', () => {
  const dir = mkdtempSync(join(tmpdir(), 'identity-release-notes-'));
  try {
    for (const name of ['scripts', 'backend', 'frontend']) mkdirSync(join(dir, name));
    for (const name of ['identity-version.mjs', 'auth-release.mjs']) {
      copyFileSync(join(root, 'scripts', name), join(dir, 'scripts', name));
    }
    writeFileSync(join(dir, 'backend/package.json'), JSON.stringify({ version: '1.2.3' }));
    for (const name of ['backend', 'frontend']) {
      writeFileSync(join(dir, name, 'CHANGELOG.md'), `# Changelog\n\n## 1.2.3\n\n${name} patch.\n\n## 1.2.2\n\nOld change.\n`);
    }
    const output = execFileSync(process.execPath, [join(dir, 'scripts/identity-version.mjs'), 'notes'], { encoding: 'utf8' });
    assert(output.includes('## backend\n\nbackend patch.'));
    assert(output.includes('## frontend\n\nfrontend patch.'));
    assert(!output.includes('Old change.'));
    writeFileSync(join(dir, 'frontend/CHANGELOG.md'), '# Changelog\n\n## 1.2.2\n\nOld change.\n');
    assert.throws(() => execFileSync(process.execPath, [join(dir, 'scripts/identity-version.mjs'), 'notes'], { stdio: 'pipe' }), /Command failed/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
