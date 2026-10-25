"""Exercise built images with disposable PostgreSQL; never uses deployment env files."""
import argparse
import json
import os
from pathlib import Path
import secrets
import subprocess
import tempfile
import time

ROOT = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--backend-image', help='Use a locally built backend candidate')
parser.add_argument('--rollback-image', help='Also replace candidate with this local baseline and restore it')
args = parser.parse_args()

with tempfile.TemporaryDirectory(prefix='identity-docker-') as directory:
    directory = Path(directory)
    password = secrets.token_hex(24)
    config = {
        'NODE_ENV': 'production', 'DB_HOST': 'smoke-db', 'DB_PORT': '5432',
        'DB_USERNAME': 'identity', 'DB_PASSWORD': password, 'DB_DATABASE': 'identity',
        'DB_SSL': 'false', 'APP_ISSUER': 'https://id.example.test',
        'ID_FRONTEND_URL': 'https://id.example.test',
        'APP_CORS_ORIGINS': 'https://id.example.test',
        'AUTH_ALLOWED_REDIRECT_URIS': 'https://id.example.test/auth/callback',
        'ACCESS_API_URL': 'https://access.example.test',
        'ACCESS_JWKS_URI': 'https://access.example.test/.well-known/jwks.json',
        'COOKIE_SECURE': 'true', 'SUPER_ADMIN_PASSWORD': password,
    }
    for key in ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'OAUTH_STATE_SECRET']:
        config[key] = secrets.token_hex(32)
    for client in ['CONSOLE_IDENTITY_ADMIN', 'CONSOLE_ACCESS_ADMIN',
                   'BILLING_LEGAL_SERVICE', 'ACCESS_LEGAL_VALIDATOR',
                   'BALANZ_BILLING_SERVICE', 'LEGAL_SERVICE_DEV',
                   'LEGAL', 'CONSOLE', 'BILLING', 'DOCS', 'ACCESS', 'HELPDESK']:
        config['OAUTH_CLIENT_SECRET_' + client] = secrets.token_hex(32)
    env_file = directory / 'production.env'
    env_file.write_text(''.join(f'{key}={value}\n' for key, value in config.items()))
    env_file.chmod(0o600)
    override = directory / 'compose.json'
    overrides = {'services': {'smoke-db': {
        'image': 'postgres:18-alpine',
        'environment': {'POSTGRES_USER': 'identity', 'POSTGRES_PASSWORD': password,
                        'POSTGRES_DB': 'identity'},
        'tmpfs': ['/var/lib/postgresql'],
        'healthcheck': {'test': ['CMD-SHELL', 'pg_isready -U identity'],
                        'interval': '1s', 'timeout': '3s', 'retries': 30},
    }, 'backend': {'depends_on': {'smoke-db': {'condition': 'service_healthy'}}}}}
    if args.backend_image:
        overrides['services']['backend']['image'] = args.backend_image
    override.write_text(json.dumps(overrides))
    environment = {**os.environ, 'IDENTITY_ENV_FILE': str(env_file),
                   'IDENTITY_BIND_ADDRESS': '127.0.0.1', 'IDENTITY_HTTP_PORT': '0'}
    compose = ['docker', 'compose', '--env-file', '/dev/null', '-p',
               'identity-smoke-' + secrets.token_hex(4), '-f', str(ROOT / 'docker-compose.yml'),
               '-f', str(override)]

    def run(*args, capture=False, quiet_failure=False):
        result = subprocess.run(compose + list(args), env=environment, cwd=ROOT,
                                text=True, capture_output=capture)
        if result.returncode and capture and not quiet_failure:
            print((result.stdout + result.stderr).replace(password, '[REDACTED]'), flush=True)
        result.check_returncode()
        return result.stdout

    def check_http(service, path, assertion, quiet_failure=False):
        port = 4000 if service == 'backend' else 8080
        script = (f"fetch('http://127.0.0.1:{port}{path}').then(async r=>{{"
                  f"const body=await r.json(); if(!({assertion})) throw Error(JSON.stringify(body));"
                  "}).catch(e=>{console.error(e);process.exit(1)})")
        # Node is available only in backend; frontend checks go through Docker DNS.
        if service == 'frontend':
            script = script.replace('127.0.0.1', 'frontend')
        run('exec', '-T', 'backend', 'node', '-e', script,
            capture=True, quiet_failure=quiet_failure)

    try:
        print(run('run', '--rm', '--no-deps', 'backend', 'node', '-e',
            (ROOT / 'test/docker/backend-runtime.cjs').read_text(), capture=True), end='', flush=True)
        run('up', '-d', '--no-build', 'backend')
        for attempt in range(60):
            try:
                check_http('backend', '/api/v1/health/live',
                           "r.status===200 && body.status==='ok'", quiet_failure=True)
                break
            except subprocess.CalledProcessError:
                time.sleep(1)
        else:
            raise RuntimeError('Backend did not start')
        check_http('backend', '/api/v1/health/ready',
                   "r.status===503 && body.reason==='pending_migrations'")
        print('PASS: startup does not apply migrations', flush=True)
        run('run', '--rm', '--no-deps', 'backend', 'node', 'node_modules/typeorm/cli.js',
            'migration:run', '-d', 'dist/data-source.js', capture=True)
        run('run', '--rm', '--no-deps', 'backend', 'node',
            'dist/src/database/seeds/run-seeds.js', capture=True)
        check_http('backend', '/api/v1/health/ready', "r.status===200 && body.status==='ok'")
        run('up', '-d', '--no-build', '--wait', '--wait-timeout', '90')
        for path in ['/api/v1/health/ready', '/.well-known/openid-configuration',
                     '/.well-known/jwks.json']:
            check_http('frontend', path, 'r.status===200')
        check_http('frontend', '/.well-known/openid-configuration',
                   "body.issuer==='https://id.example.test'")
        check_http('frontend', '/api/v1/auth/google', 'r.status===503')
        for path in ['/oauth/token', '/oidc/userinfo']:
            check_http('frontend', path, 'r.status>=400 && r.status<500')
        run('exec', '-T', 'frontend', 'wget', '-q', '-O', '/dev/null',
            'http://127.0.0.1:8080/auth/login', capture=True)
        login = """fetch('http://frontend:8080/api/v1/auth/login', {
          method: 'POST', headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({identifier: 'admin@hemia.cloud',
                                password: process.env.SUPER_ADMIN_PASSWORD})
        }).then(r => {
          const cookies = r.headers.getSetCookie();
          if (!r.ok || cookies.length < 2 ||
              !cookies.every(c => c.includes('Secure') && c.includes('HttpOnly')))
            throw Error('Login or secure cookies failed: ' + r.status);
        }).catch(e => {console.error(e); process.exit(1)})"""
        run('exec', '-T', 'backend', 'node', '-e', login, capture=True)
        print('PASS: manual migrations/seeds, readiness, SPA, OAuth/OIDC, JWKS and secure login', flush=True)
        if args.rollback_image:
            candidate = json.loads(run('config', '--format', 'json', capture=True))['services']['backend']['image']
            for image in [args.rollback_image, candidate]:
                overrides['services']['backend']['image'] = image
                override.write_text(json.dumps(overrides))
                run('up', '-d', '--no-build', '--wait', '--wait-timeout', '90')
                check_http('frontend', '/api/v1/health/ready', "r.status===200 && body.status==='ok'")
                check_http('frontend', '/.well-known/openid-configuration',
                           "r.status===200 && body.issuer==='https://id.example.test'")
                check_http('frontend', '/.well-known/jwks.json', 'r.status===200 && body.keys.length>0')
                run('exec', '-T', 'backend', 'node', '-e', login, capture=True)
                print('PASS: local image replacement, health and login: ' + image, flush=True)
        run('stats', '--no-stream')
    finally:
        run('down', '-v', '--remove-orphans')
