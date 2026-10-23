#!/usr/bin/env bash
set -euo pipefail
identity_root="$(cd "$(dirname "$0")/../../.." && pwd)"
container="identity-scope-catalog-test-$$"
trap 'docker rm -f -v "$container" >/dev/null 2>&1 || true' EXIT
docker run -d --rm --name "$container" -p 127.0.0.1::5432 -e POSTGRES_PASSWORD=isolated-test-only -e POSTGRES_DB=identity_destinations_test postgres:18.4 >/dev/null
for attempt in {1..60}; do
 if docker exec "$container" pg_isready -h 127.0.0.1 -U postgres -d identity_destinations_test >/dev/null 2>&1; then break; fi
 sleep 1
done
OAUTH_DESTINATION_TEST_PORT="$(docker port "$container" 5432/tcp | awk -F: '{print $NF}')" node "$identity_root/test/backend/integration/scope-catalog.integration.cjs"
