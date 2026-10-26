import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareVersions } from './auth-release.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const versionFiles = ['backend/package.json', 'frontend/package.json',
  'backend/CHANGELOG.md', 'frontend/CHANGELOG.md', 'bun.lock'];

export function identityChangeset(source) {
  const header = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1] ?? '';
  const targets = [...header.matchAll(/^\s*["']?([^"'\s:]+)["']?\s*:\s*(patch|minor|major)\s*$/gm)].map(m => m[1]);
  return targets.length > 0 && targets.every(name => ['backend', 'frontend'].includes(name));
}

export function isIdentityVersionBatch(before, after, files, removedNotes) {
  assert.equal(after.backend, after.frontend, 'Identity packages must share a version');
  compareVersions(after.backend, after.frontend); // Validate stable SemVer.
  if (before.backend === after.backend || before.frontend === after.frontend) return false;
  assert(compareVersions(after.backend, before.backend) > 0 &&
    compareVersions(after.frontend, before.frontend) > 0, 'Identity version must increase');
  const consumed = new Set(removedNotes.filter(note => identityChangeset(note.source)).map(note => note.path));
  return consumed.size > 0 && versionFiles.every(name => files.includes(name)) &&
    files.every(name => versionFiles.includes(name) || consumed.has(name));
}

export function retryReleaseTag(tag, backend, frontend) {
  assert.equal(backend, frontend, 'Identity packages must share a version');
  compareVersions(backend, frontend);
  assert.equal(tag, `identity-v${backend}`, 'Retry tag must match the committed version');
  return tag;
}

function pending() {
  const found = readdirSync(join(root, '.changeset')).filter(name => name.endsWith('.md'))
    .some(name => identityChangeset(readFileSync(join(root, '.changeset', name), 'utf8')));
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `pending=${found}\n`);
  console.log(`Pending Identity changesets: ${found}`);
}

function retry(tag) {
  const versions = ['backend', 'frontend'].map(name => JSON.parse(readFileSync(join(root, name, 'package.json'), 'utf8')).version);
  retryReleaseTag(tag, ...versions);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `release=true\ntag=${tag}\n`);
  console.log(`Explicit unpublished release retry: ${tag}`);
}

function classify(base) {
  assert(/^[a-f0-9]{40}$/.test(base) && !/^0+$/.test(base), 'Expected previous main commit');
  const before = {}, after = {};
  for (const name of ['backend', 'frontend']) {
    before[name] = JSON.parse(git('show', `${base}:${name}/package.json`)).version;
    after[name] = JSON.parse(readFileSync(join(root, name, 'package.json'), 'utf8')).version;
  }
  const files = git('diff', '--name-only', base, 'HEAD').split('\n').filter(Boolean);
  const removedNotes = git('diff', '--diff-filter=D', '--name-only', base, 'HEAD', '--', '.changeset')
    .split('\n').filter(name => /^\.changeset\/[a-z0-9-]+\.md$/.test(name))
    .map(path => ({ path, source: git('show', `${base}:${path}`) }));
  const release = isIdentityVersionBatch(before, after, files, removedNotes);
  const tag = `identity-v${after.backend}`;
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `release=${release}\ntag=${tag}\n`);
  console.log(release ? `Identity version-only merge: ${tag}` : 'No Identity version-only merge; update version PR if pending');
}

function notes() {
  const version = JSON.parse(readFileSync(join(root, 'backend/package.json'), 'utf8')).version;
  const sections = [];
  for (const name of ['backend', 'frontend']) {
    const text = readFileSync(join(root, name, 'CHANGELOG.md'), 'utf8');
    const entry = text.split(/^## /m).slice(1).find(section => section.split(/\r?\n/, 1)[0].trim() === version);
    assert(entry, `Missing ${name} changelog entry for ${version}`);
    sections.push(`## ${name}\n\n${entry.slice(version.length).trim()}`);
  }
  console.log(sections.join('\n\n'));
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command, argument] = process.argv.slice(2);
  if (command === 'classify') classify(argument);
  else if (command === 'notes') notes();
  else if (command === 'pending') pending();
  else if (command === 'retry') retry(argument);
  else throw new Error('Usage: node scripts/identity-version.mjs <classify BASE_SHA|notes|pending|retry TAG>');
}
