#!/usr/bin/env bash
set -euo pipefail
identity_root="$(cd "$(dirname "$0")/../../.." && pwd)"
container="identity-seed-clients-test-$$"
trap 'docker rm -f -v "$container" >/dev/null 2>&1 || true' EXIT
docker run --detach --rm --name "$container" --publish 127.0.0.1::5432 \
  --env POSTGRES_PASSWORD=isolated-test-only --env POSTGRES_DB=identity_seed_test postgres:18.4 >/dev/null
for attempt in {1..60}; do
  if docker exec "$container" pg_isready -h 127.0.0.1 -U postgres -d identity_seed_test >/dev/null 2>&1; then break; fi
  sleep 1
done
SEED_TEST_DATABASE_PORT="$(docker port "$container" 5432/tcp | awk -F: '{print $NF}')" \
  node "$identity_root/test/backend/integration/seed-clients.integration.cjs"
