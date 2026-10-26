import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, readFileSync, realpathSync } from 'node:fs';
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

export function isReviewedVersionBatch(beforeVersion, afterVersion, files, deleted = [], bootstrap = null) {
  if (!beforeVersion) return false;
  if (beforeVersion === afterVersion) {
    return afterVersion === '1.0.8' &&
      files.length === 1 &&
      files[0] === '.changeset/bootstrap-auth-1.0.8.json' &&
      bootstrap?.name === packageName && bootstrap.version === afterVersion &&
      Object.keys(bootstrap).length === 2;
  }
  assert(compareVersions(afterVersion, beforeVersion) > 0, 'Package version must increase');
  const required = [manifestPath, 'packages/auth/CHANGELOG.md', 'bun.lock'];
  return required.every((file) => files.includes(file)) &&
    deleted.some((file) => /^\.changeset\/[a-z0-9-]+\.md$/.test(file) && files.includes(file)) && files.every((file) =>
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

export function changelogNotes(changelog, version) {
  compareVersions(version, version);
  const sections = [...changelog.matchAll(/^## ([^\r\n]+)\r?$/gm)];
  const index = sections.findIndex((section) => section[1] === version);
  assert(index >= 0, `Missing changelog entry for ${version}`);
  const start = sections[index].index + sections[index][0].length;
  const notes = changelog.slice(start, sections[index + 1]?.index ?? changelog.length).trim();
  assert(notes, `Empty changelog entry for ${version}`);
  return notes;
}

export async function createGitHubRelease({ version, commit, notes, token }, request = fetch) {
  compareVersions(version, version);
  assert(/^[a-f0-9]{40}$/.test(commit), 'Expected the published commit');
  assert(token, 'GitHub release requires GH_TOKEN');
  assert(notes.trim(), 'GitHub release requires changelog notes');
  const tag = `${packageName}@${version}`;
  const encoded = encodeURIComponent(tag);
  const api = async (path, body) => {
    const response = await request(`https://api.github.com/repos/hemia-labs/identity/${path}`, {
      method: body ? 'POST' : 'GET',
      headers: {
        Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28',
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      redirect: 'error', signal: AbortSignal.timeout(30_000),
    });
    if (response.status === 404 && !body) return null;
    assert(response.ok, `GitHub ${body ? 'POST' : 'GET'} ${path} failed: HTTP ${response.status}`);
    return response.json();
  };
  let ref = await api(`git/ref/tags/${encoded}`);
  if (!ref) ref = await api('git/refs', { ref: `refs/tags/${tag}`, sha: commit });
  assert.equal(ref.object?.type, 'commit', 'Expected a lightweight release tag');
  assert.equal(ref.object?.sha, commit, 'Existing release tag points to another commit');
  const existing = await api(`releases/tags/${encoded}`);
  if (existing) {
    assert.equal(existing.tag_name, tag);
    assert.equal(existing.name, tag, 'Existing release title differs');
    assert.equal(existing.draft, false, 'Existing release is still a draft');
    assert.equal(existing.prerelease, false, 'Existing release is a prerelease');
    console.log(`GitHub Release ${tag} already exists; skipping`);
    return;
  }
  await api('releases', {
    tag_name: tag, target_commitish: commit, name: tag, body: notes,
    draft: false, prerelease: false,
  });
  console.log(`Created GitHub Release ${tag}`);
}

function classify(base) {
  assert(/^[a-f0-9]{40}$/.test(base) && !/^0+$/.test(base), 'Expected the previous main commit');
  const before = JSON.parse(git('show', `${base}:${manifestPath}`));
  const after = readJson(join(root, manifestPath));
  const files = execFileSync('git', ['diff', '--name-only', '-z', base, 'HEAD'], { cwd: root, encoding: 'utf8' })
    .split('\0').filter(Boolean);
  const deleted = execFileSync('git', ['diff', '--diff-filter=D', '--name-only', '-z', base, 'HEAD'], { cwd: root, encoding: 'utf8' })
    .split('\0').filter(Boolean);
  const bootstrap = files.includes('.changeset/bootstrap-auth-1.0.8.json')
    ? readJson(join(root, '.changeset/bootstrap-auth-1.0.8.json')) : null;
  const release = isReviewedVersionBatch(before.version, after.version, files, deleted, bootstrap);
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
  assert.equal(process.env.GITHUB_REF, 'refs/heads/main');
  assert.equal(process.env.ENABLE_NPM_PUBLISH, 'true', 'Publication gate is disabled');
  const { release, tarball } = loadArtifact(directory);
  const notes = changelogNotes(readFileSync(join(root, 'packages/auth/CHANGELOG.md'), 'utf8'), release.version);
  assert(process.env.GH_TOKEN, 'GitHub release requires GH_TOKEN');
  const finish = () => createGitHubRelease({ version: release.version, commit: release.commit, notes, token: process.env.GH_TOKEN });
  let decision = registryDecision(await readRegistry(), release.version, release.integrity);
  if (decision === 'already-published') {
    console.log(`${packageName}@${release.version} already published with the same tarball; skipping npm publication`);
    return finish();
  }
  execFileSync('npm', ['publish', tarball, '--ignore-scripts', '--access', 'public', '--registry', registry], {
    cwd: root, stdio: 'inherit',
  });
  for (let attempt = 0; attempt < 6; attempt++) {
    decision = registryDecision(await readRegistry(), release.version, release.integrity);
    if (decision === 'already-published') {
      console.log(`Published and verified ${packageName}@${release.version}`);
      return finish();
    }
    await setTimeout(5_000);
  }
  throw new Error('npm publish succeeded, but registry visibility is pending; inspect npm before retrying');
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command, argument] = process.argv.slice(2);
  if (command === 'classify') classify(argument);
  else if (command === 'notes') {
    const { version } = readJson(join(root, manifestPath));
    console.log(changelogNotes(readFileSync(join(root, 'packages/auth/CHANGELOG.md'), 'utf8'), version));
  }
  else if (command === 'inspect') {
    const { release } = loadArtifact(resolve(argument));
    console.log(`${release.name}@${release.version}: ${registryDecision(await readRegistry(), release.version, release.integrity)}`);
  } else if (command === 'publish') await publish(resolve(argument));
  else throw new Error('Usage: node scripts/auth-release.mjs <classify BASE_SHA|notes|inspect DIR|publish DIR>');
}
