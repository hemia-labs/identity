"""Create/validate the immutable deployment assets for an Identity release."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess

TAG = re.compile(r'identity-v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\Z')
IMAGE = re.compile(r'ghcr\.io/hemia-labs/identity-(backend|frontend)@sha256:[a-f0-9]{64}\Z')


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def validate(directory, expected_tag=None):
    directory = Path(directory)
    manifest = json.loads((directory / 'release.json').read_text())
    if manifest.get('schema') != 1 or not TAG.fullmatch(manifest.get('tag', '')):
        raise ValueError('Invalid Identity release tag/schema')
    if expected_tag and manifest['tag'] != expected_tag:
        raise ValueError('Release does not match requested tag')
    if not re.fullmatch('[a-f0-9]{40}', manifest.get('commit', '')):
        raise ValueError('Invalid commit')
    if not isinstance(manifest.get('migrations'), dict) or any(
        not re.fullmatch(r'[A-Za-z0-9_-]+\.ts', name) or not re.fullmatch('[a-f0-9]{64}', value)
        for name, value in manifest['migrations'].items()
    ):
        raise ValueError('Invalid migration manifest')
    for service in ['backend', 'frontend']:
        match = IMAGE.fullmatch(manifest['images'][service])
        if not match or match.group(1) != service:
            raise ValueError('Expected the correct GHCR image pinned by digest')
    for name in ['compose.json', 'identity-deploy.py']:
        if digest(directory / name) != manifest['files'][name]:
            raise ValueError('Release asset checksum mismatch: ' + name)
    config = json.loads((directory / 'compose.json').read_text())
    if set(config['services']) != {'backend', 'frontend'}:
        raise ValueError('Unexpected services in Identity release')
    for service in config['services']:
        if config['services'][service].get('build') or config['services'][service]['image'] != manifest['images'][service]:
            raise ValueError('Compose must use the release images without building')
    return manifest


def create(tag, output):
    if not TAG.fullmatch(tag):
        raise ValueError('Expected identity-vMAJOR.MINOR.PATCH')
    root = Path(__file__).resolve().parents[1]
    output = Path(output)
    output.mkdir(parents=True, exist_ok=True)
    config = json.loads(subprocess.check_output([
        'docker', 'compose', '--env-file', '/dev/null', 'config', '--format', 'json'
    ], cwd=root, env={**os.environ, 'IDENTITY_ENV_FILE': '/dev/null'}, text=True))
    images = {}
    for service in ['backend', 'frontend']:
        image = f'ghcr.io/hemia-labs/identity-{service}:{tag}'
        info = json.loads(subprocess.check_output(['docker', 'image', 'inspect', image], text=True))[0]
        prefix = f'ghcr.io/hemia-labs/identity-{service}@'
        images[service] = next(value for value in info['RepoDigests'] if value.startswith(prefix))
        config['services'][service].pop('build', None)
        config['services'][service]['image'] = images[service]
    config['services']['backend']['env_file'] = [{'path': '${IDENTITY_ENV_FILE:?Set the server environment file}', 'format': 'raw'}]
    config['services']['frontend']['ports'] = ['${IDENTITY_BIND_ADDRESS:-127.0.0.1}:${IDENTITY_HTTP_PORT:-8080}:8080']
    (output / 'compose.json').write_text(json.dumps(config, indent=2) + '\n')
    (output / 'identity-deploy.py').write_bytes((root / 'scripts/identity-deploy.py').read_bytes())
    manifest = {
        'schema': 1, 'tag': tag,
        'commit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip(),
        'images': images,
        'migrations': {p.name: digest(p) for p in sorted((root / 'backend/src/database/migrations').glob('*.ts'))},
        'files': {name: digest(output / name) for name in ['compose.json', 'identity-deploy.py']},
    }
    (output / 'release.json').write_text(json.dumps(manifest, indent=2) + '\n')
    validate(output, tag)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('command', choices=['create', 'validate'])
    parser.add_argument('tag')
    parser.add_argument('directory')
    args = parser.parse_args()
    if args.command == 'create':
        create(args.tag, args.directory)
    else:
        validate(args.directory, args.tag)
