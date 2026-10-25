import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, readFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout } from 'node:timers/promises';

const root = fileURLToPath(new URL('../', import.meta.url));
const packageName = '@hemia/auth';
const registry = 'https://registry.npmjs.org';
const repository = 'git+https://github.com/hemia-labs/identity.git';
const manifestPath = 'packages/auth/package.json';
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();

export function compareVersions(left, right) {
  const parse = (value) => {
    assert(/^\d+\.\d+\.\d+$/.test(value), `Expected a stable version: ${value}`);
    return value.split('.').map(Number);
  };
  const a = parse(left);
  const b = parse(right);
  assert([...a, ...b].every(Number.isSafeInteger), 'Version number is too large');
  return a.map((value, index) => Math.sign(value - b[index])).find(Boolean) ?? 0;
}

export function isReviewedVersionBatch(beforeVersion, afterVersion, files, bootstrap = null) {
  if (beforeVersion === afterVersion) {
    return afterVersion === '1.0.8' &&
      files.length === 1 &&
      files[0] === '.changeset/bootstrap-auth-1.0.8.json' &&
      bootstrap?.name === packageName && bootstrap.version === afterVersion &&
      Object.keys(bootstrap).length === 2;
  }
  assert(compareVersions(afterVersion, beforeVersion) > 0, 'Package version must increase');
  const required = [manifestPath, 'packages/auth/CHANGELOG.md', 'bun.lock'];
  return required.every((file) => files.includes(file)) && files.every((file) =>
    required.includes(file) || /^\.changeset\/[a-z0-9-]+\.md$/.test(file));
}

export function registryDecision(metadata, version, integrity) {
  assert(metadata, `${packageName} must already exist on npm`);
  const existing = metadata.versions?.[version];
  if (existing) {
    assert.equal(existing.dist?.integrity, integrity, 'Published version has different tarball contents');
    return 'already-published';
  }
  const latest = metadata['dist-tags']?.latest;
  if (latest) assert(compareVersions(version, latest) > 0, `Refusing to move latest backwards from ${latest}`);
  return 'publish';
}

function classify(base) {
  assert(/^[a-f0-9]{40}$/.test(base) && !/^0+$/.test(base), 'Expected the previous develop commit');
  const before = JSON.parse(git('show', `${base}:${manifestPath}`));
  const after = readJson(join(root, manifestPath));
  const files = execFileSync('git', ['diff', '--name-only', '-z', base, 'HEAD'], { cwd: root, encoding: 'utf8' })
    .split('\0').filter(Boolean);
  const bootstrap = files.includes('.changeset/bootstrap-auth-1.0.8.json')
    ? readJson(join(root, '.changeset/bootstrap-auth-1.0.8.json')) : null;
  const release = isReviewedVersionBatch(before.version, after.version, files, bootstrap);
  console.log(release ? `Reviewed version batch: ${after.version}` : 'No reviewed version batch in this push');
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `release=${release}\n`);
}

async function readRegistry() {
  const response = await fetch(`${registry}/${encodeURIComponent(packageName)}`, {
    cache: 'no-store', signal: AbortSignal.timeout(30_000),
  });
  assert(response.ok, `npm registry lookup failed: HTTP ${response.status}`);
  return response.json();
}

function loadArtifact(directory) {
  const release = readJson(join(directory, 'release.json'));
  const manifest = readJson(join(root, manifestPath));
  assert.equal(release.commit, git('rev-parse', 'HEAD'), 'Artifact commit differs from checkout');
  assert.equal(release.name, packageName);
  assert.equal(release.version, manifest.version);
  assert.equal(release.filename, `hemia-auth-${manifest.version}.tgz`);
  assert.equal(manifest.repository?.url, repository);
  assert.equal(manifest.publishConfig?.access, 'public');
  const tarball = join(directory, basename(release.filename));
  const integrity = `sha512-${createHash('sha512').update(readFileSync(tarball)).digest('base64')}`;
  assert.equal(release.integrity, integrity, 'Artifact integrity changed after validation');
  const packed = JSON.parse(execFileSync('tar', ['-xOf', tarball, 'package/package.json'], { encoding: 'utf8' }));
  assert.equal(packed.name, manifest.name);
  assert.equal(packed.version, manifest.version);
  assert.equal(packed.repository?.url, manifest.repository.url);
  return { release, tarball };
}

async function publish(directory) {
  assert.equal(process.env.GITHUB_ACTIONS, 'true', 'Publishing requires GitHub Actions');
  assert.equal(process.env.GITHUB_EVENT_NAME, 'push', 'Publishing requires a merged version PR');
  assert.equal(process.env.GITHUB_REPOSITORY, 'hemia-labs/identity');
  assert.equal(process.env.GITHUB_REF, 'refs/heads/develop');
  assert.equal(process.env.ENABLE_NPM_PUBLISH, 'true', 'Publication gate is disabled');
  const { release, tarball } = loadArtifact(directory);
  let decision = registryDecision(await readRegistry(), release.version, release.integrity);
  if (decision === 'already-published') {
    console.log(`${packageName}@${release.version} already published with the same tarball; skipping`);
    return;
  }
  execFileSync('npm', ['publish', tarball, '--ignore-scripts', '--access', 'public', '--registry', registry], {
    cwd: root, stdio: 'inherit',
  });
  for (let attempt = 0; attempt < 6; attempt++) {
    decision = registryDecision(await readRegistry(), release.version, release.integrity);
    if (decision === 'already-published') {
      console.log(`Published and verified ${packageName}@${release.version}`);
      return;
    }
    await setTimeout(5_000);
  }
  throw new Error('npm publish succeeded, but registry visibility is pending; inspect npm before retrying');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command, argument] = process.argv.slice(2);
  if (command === 'classify') classify(argument);
  else if (command === 'inspect') {
    const { release } = loadArtifact(resolve(argument));
    console.log(`${release.name}@${release.version}: ${registryDecision(await readRegistry(), release.version, release.integrity)}`);
  } else if (command === 'publish') await publish(resolve(argument));
  else throw new Error('Usage: node scripts/auth-release.mjs <classify BASE_SHA|inspect DIR|publish DIR>');
}
