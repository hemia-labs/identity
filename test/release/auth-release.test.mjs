import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { isReviewedVersionBatch, registryDecision, changelogNotes, createGitHubRelease } from '../../scripts/auth-release.mjs';

const versionFiles = [
  'packages/auth/package.json',
  'packages/auth/CHANGELOG.md',
  'bun.lock',
  '.changeset/auth-fix.md',
];

const deleted = ['.changeset/auth-fix.md'];

test('only a reviewed version batch can trigger publication', () => {
  assert.equal(isReviewedVersionBatch('1.0.8', '1.0.9', versionFiles, deleted), true);
  assert.equal(isReviewedVersionBatch('1.0.4', '1.0.8', [
    ...versionFiles, 'packages/auth/src/core/clients/access-client.ts',
  ]), false);
  assert.equal(isReviewedVersionBatch('1.0.8', '1.0.9', versionFiles.filter((file) => file !== 'bun.lock'), deleted), false);
  assert.equal(isReviewedVersionBatch('1.0.8', '1.0.8', versionFiles), false);
  assert.equal(isReviewedVersionBatch('1.0.8', '1.0.8', ['.changeset/bootstrap-auth-1.0.8.json'], [], {
    name: '@hemia/auth', version: '1.0.8',
  }), true);
  assert.equal(isReviewedVersionBatch('1.0.8', '1.0.8', [
    '.changeset/bootstrap-auth-1.0.8.json', 'packages/auth/src/core/index.ts',
  ], [], { name: '@hemia/auth', version: '1.0.8' }), false);
  assert.equal(isReviewedVersionBatch('1.0.8', '1.0.9', versionFiles), false);
  assert.equal(isReviewedVersionBatch(null, '1.0.9', versionFiles, deleted), false);
  assert.throws(() => isReviewedVersionBatch('1.0.9', '1.0.8', versionFiles), /must increase/);
});

test('registry preflight skips an identical version and rejects conflicts or rollback', () => {
  const metadata = {
    'dist-tags': { latest: '1.0.8' },
    versions: { '1.0.8': { dist: { integrity: 'sha512-tested' } } },
  };
  assert.equal(registryDecision(metadata, '1.0.9', 'sha512-next'), 'publish');
  assert.equal(registryDecision(metadata, '1.0.8', 'sha512-tested'), 'already-published');
  assert.throws(() => registryDecision(metadata, '1.0.8', 'sha512-different'), /different tarball/);
  assert.throws(() => registryDecision(metadata, '1.0.7', 'sha512-old'), /backwards/);
  assert.throws(() => registryDecision(null, '1.0.9', 'sha512-next'), /must already exist/);
});

test('Changesets notes include only the exact version, preserving its Markdown', () => {
  const changelog = '# @hemia/auth\n\n## 0.3.0\n\n### Minor Changes\n\n- Add **Legal**.\n\n## 0.2.0\n\n- Old notes.\n';
  assert.equal(changelogNotes(changelog, '0.3.0'), '### Minor Changes\n\n- Add **Legal**.');
  assert.equal(changelogNotes(changelog.replaceAll('\n', '\r\n'), '0.2.0'), '- Old notes.');
  assert.throws(() => changelogNotes(changelog, '0.4.0'), /Missing changelog/);
  assert.throws(() => changelogNotes('## 0.3.0\n\n## 0.2.0\nold', '0.3.0'), /Empty changelog/);
});

const releaseInput = { version: '0.3.0', commit: 'a'.repeat(40), notes: '### Minor Changes\n\n- SDK integration.', token: 'fixture-only' };
const tagName = '@hemia/auth@0.3.0';
const ref = { object: { type: 'commit', sha: releaseInput.commit } };
const githubFixture = (responses) => {
  const calls = [];
  return {
    calls,
    request: async (url, options) => {
      calls.push({ path: url.replace('https://api.github.com/repos/hemia-labs/identity/', ''), method: options.method, body: options.body ? JSON.parse(options.body) : undefined });
      assert.equal(options.headers.Authorization, 'Bearer fixture-only');
      assert.equal(options.redirect, 'error');
      assert(responses.length, 'Unexpected GitHub request');
      const [status, body] = responses.shift();
      return new Response(JSON.stringify(body), { status });
    },
  };
};

test('GitHub Release creates the exact tag and title at the validated commit with changelog notes', async () => {
  const fixture = githubFixture([[404, {}], [201, ref], [404, {}], [201, {}]]);
  await createGitHubRelease(releaseInput, fixture.request);
  assert.deepEqual(fixture.calls.map(({path, method}) => [path, method]), [
    ['git/ref/tags/%40hemia%2Fauth%400.3.0', 'GET'], ['git/refs', 'POST'],
    ['releases/tags/%40hemia%2Fauth%400.3.0', 'GET'], ['releases', 'POST'],
  ]);
  assert.deepEqual(fixture.calls[1].body, { ref: `refs/tags/${tagName}`, sha: releaseInput.commit });
  assert.deepEqual(fixture.calls[3].body, { tag_name: tagName, target_commitish: releaseInput.commit, name: tagName, body: releaseInput.notes, draft: false, prerelease: false });
});

test('reruns preserve an existing tag and release and recover after tag creation only', async () => {
  const existing = { tag_name: tagName, name: tagName, draft: false, prerelease: false };
  const complete = githubFixture([[200, ref], [200, existing]]);
  await createGitHubRelease(releaseInput, complete.request);
  assert(complete.calls.every(call => call.method === 'GET'));
  const partial = githubFixture([[200, ref], [404, {}], [201, {}]]);
  await createGitHubRelease(releaseInput, partial.request);
  assert.deepEqual(partial.calls.filter(call => call.method === 'POST').map(call => call.path), ['releases']);
});

test('GitHub failures and a tag on another commit fail closed without rewriting a tag', async () => {
  const wrong = githubFixture([[200, { object: { type: 'commit', sha: 'b'.repeat(40) } }]]);
  await assert.rejects(createGitHubRelease(releaseInput, wrong.request), /another commit/);
  assert.equal(wrong.calls.length, 1);
  for (const status of [403, 500]) {
    const failed = githubFixture([[status, { message: 'provider details' }]]);
    await assert.rejects(createGitHubRelease(releaseInput, failed.request), new RegExp(`HTTP ${status}$`));
    assert.equal(failed.calls.length, 1);
  }
  const noToken = githubFixture([]);
  await assert.rejects(createGitHubRelease({ ...releaseInput, token: '' }, noToken.request), /GH_TOKEN/);
  assert.equal(noToken.calls.length, 0);
});


test('Auth release uses main, isolates its version PR and verifies before npm/GitHub publication', () => {
  const workflow = readFileSync(new URL('../../.github/workflows/auth-release.yml', import.meta.url), 'utf8');
  assert(workflow.includes('branches: [main]'));
  assert(workflow.includes("github.ref == 'refs/heads/main'"));
  const version = workflow.split('\n  version-pr:\n')[1].split('\n  validate:\n')[0];
  assert(version.includes('needs: [classify, validate]'));
  assert(version.includes('branch: changeset-release/auth'));
  assert(version.includes('base: main'));
  assert(version.includes('bun run version:auth'));
  assert(version.includes('node scripts/auth-release.mjs notes'));
  const validate = workflow.split('\n  validate:\n')[1].split('\n  publish:\n')[0];
  assert(!/^    if:/m.test(validate), 'Both code and version merges must be validated');
  assert(validate.includes('uses: ./.github/workflows/package-auth.yml'));
  assert(validate.includes("preserve-release-artifact: ${{ needs.classify.outputs.release == 'true' }}"));
  const checks = readFileSync(new URL('../../.github/workflows/package-auth.yml', import.meta.url), 'utf8');
  assert(checks.includes('workflow_call:'));
  assert(checks.includes('if: inputs.preserve-release-artifact'));
  assert(checks.includes('node --test test/release/auth-*.test.mjs'));
  const publish = workflow.split('\n  publish:\n')[1];
  assert(publish.includes('needs: [classify, validate]'));
  assert(publish.includes('contents: write'));
  assert(publish.includes('id-token: write'));
  assert(publish.includes('GH_TOKEN: ${{ github.token }}'));
  const config = JSON.parse(readFileSync(new URL('../../.changeset/config.json', import.meta.url)));
  assert.equal(config.baseBranch, 'main');
  assert(!readFileSync(new URL('../../.github/workflows/identity-release.yml', import.meta.url), 'utf8').includes('branch: changeset-release/auth'));
});
