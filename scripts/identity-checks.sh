#!/usr/bin/env bash
set -euo pipefail
bun install --frozen-lockfile
node --test test/release/*.test.mjs
bun run --cwd backend test --runInBand
bun run --cwd backend build
bun run --cwd frontend type-check
bun run --cwd frontend test --run
python3 -m unittest discover -s test/deploy -p 'test_*.py'
IDENTITY_ENV_FILE=/dev/null docker compose --env-file /dev/null build
python3 test/docker/smoke.py
