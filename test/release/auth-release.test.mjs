import assert from 'node:assert/strict';
import test from 'node:test';
import { isReviewedVersionBatch, registryDecision } from '../../scripts/auth-release.mjs';

const versionFiles = [
  'packages/auth/package.json',
  'packages/auth/CHANGELOG.md',
  'bun.lock',
  '.changeset/auth-fix.md',
];

test('only a reviewed version batch can trigger publication', () => {
  assert.equal(isReviewedVersionBatch('1.0.8', '1.0.9', versionFiles), true);
  assert.equal(isReviewedVersionBatch('1.0.4', '1.0.8', [
    ...versionFiles, 'packages/auth/src/core/clients/access-client.ts',
  ]), false);
  assert.equal(isReviewedVersionBatch('1.0.8', '1.0.9', versionFiles.filter((file) => file !== 'bun.lock')), false);
  assert.equal(isReviewedVersionBatch('1.0.8', '1.0.8', versionFiles), false);
  assert.equal(isReviewedVersionBatch('1.0.8', '1.0.8', ['.changeset/bootstrap-auth-1.0.8.json'], {
    name: '@hemia/auth', version: '1.0.8',
  }), true);
  assert.equal(isReviewedVersionBatch('1.0.8', '1.0.8', [
    '.changeset/bootstrap-auth-1.0.8.json', 'packages/auth/src/core/index.ts',
  ], { name: '@hemia/auth', version: '1.0.8' }), false);
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
