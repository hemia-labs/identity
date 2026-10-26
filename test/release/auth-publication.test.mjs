import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

for (const published of [false, true]) {
  test(`publication CLI completes tag and Changesets release; npm already published=${published}`, () => {
    const dir = mkdtempSync(join(tmpdir(), 'auth-publication-'));
    try {
      for (const path of ['scripts', 'packages/auth', 'packed/package', 'artifact', 'bin']) {
        mkdirSync(join(dir, path), { recursive: true });
      }
      copyFileSync(new URL('../../scripts/auth-release.mjs', import.meta.url), join(dir, 'scripts/auth-release.mjs'));
      const manifest = { name: '@hemia/auth', version: '1.2.0', repository: {
        url: 'git+https://github.com/hemia-labs/identity.git',
      }, publishConfig: { access: 'public' } };
      for (const path of ['packages/auth/package.json', 'packed/package/package.json']) {
        writeFileSync(join(dir, path), JSON.stringify(manifest));
      }
      writeFileSync(join(dir, 'packages/auth/CHANGELOG.md'), '# Auth\n\n## 1.2.0\n\n- Changesets release notes.\n\n## 1.1.0\n\n- Earlier notes.\n');
      const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: 'pipe' }).trim();
      git('init', '-q', '-b', 'main');
      git('add', 'scripts', 'packages');
      git('-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-qm', 'version');
      const filename = 'hemia-auth-1.2.0.tgz';
      execFileSync('tar', ['-czf', join(dir, 'artifact', filename), '-C', join(dir, 'packed'), 'package']);
      const release = { name: manifest.name, version: manifest.version, filename, commit: git('rev-parse', 'HEAD'),
        integrity: `sha512-${createHash('sha512').update(readFileSync(join(dir, 'artifact', filename))).digest('base64')}` };
      writeFileSync(join(dir, 'artifact/release.json'), JSON.stringify(release));
      writeFileSync(join(dir, 'bin/npm'), '#!/bin/sh\nprintf "npm\\n" >> "$CALLS"\n', { mode: 0o700 });
      writeFileSync(join(dir, 'mock-fetch.mjs'), `
        import { appendFileSync } from 'node:fs';
        let lookups = 0;
        const release = ${JSON.stringify(release)};
        globalThis.fetch = async (url, options = {}) => {
          appendFileSync(process.env.CALLS, JSON.stringify({ url, body: options.body && JSON.parse(options.body) }) + '\\n');
          if (url.startsWith('https://registry.npmjs.org/')) {
            const exists = ${published} || ++lookups > 1;
            return new Response(JSON.stringify({ 'dist-tags': { latest: '1.1.0' }, versions:
              exists ? { [release.version]: { dist: { integrity: release.integrity } } } : {} }));
          }
          if (!options.body) return new Response('{}', { status: 404 });
          if (url.endsWith('/git/refs')) return new Response(JSON.stringify({ object: { type: 'commit', sha: release.commit } }), { status: 201 });
          return new Response('{}', { status: 201 });
        };
      `);
      const callsFile = join(dir, 'calls');
      execFileSync(process.execPath, ['--import', join(dir, 'mock-fetch.mjs'), join(dir, 'scripts/auth-release.mjs'), 'publish', join(dir, 'artifact')], {
        cwd: dir, stdio: 'pipe', env: { ...process.env, PATH: `${join(dir, 'bin')}:${process.env.PATH}`,
          CALLS: callsFile, GH_TOKEN: 'fixture-only', ENABLE_NPM_PUBLISH: 'true',
          GITHUB_ACTIONS: 'true', GITHUB_EVENT_NAME: 'push', GITHUB_REPOSITORY: 'hemia-labs/identity', GITHUB_REF: 'refs/heads/main' },
      });
      const calls = readFileSync(callsFile, 'utf8').trim().split('\n');
      assert.equal(calls.filter(call => call === 'npm').length, published ? 0 : 1);
      const requests = calls.filter(call => call !== 'npm').map(call => JSON.parse(call));
      const tag = requests.find(call => call.url.endsWith('/git/refs'));
      assert.deepEqual(tag.body, { ref: 'refs/tags/@hemia/auth@1.2.0', sha: release.commit });
      const githubRelease = requests.find(call => call.url.endsWith('/releases'));
      assert.equal(githubRelease.body.body, '- Changesets release notes.');
      assert.equal(githubRelease.body.name, '@hemia/auth@1.2.0');
      assert.equal(githubRelease.body.target_commitish, release.commit);
      const registryCalls = requests.filter(call => call.url.startsWith('https://registry.npmjs.org/'));
      assert.equal(registryCalls.length, published ? 1 : 2);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
}
