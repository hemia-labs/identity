#!/usr/bin/env bash
set -euo pipefail
identity_root="$(cd "$(dirname "$0")/../../.." && pwd)"
container="hemia-payments-flow-test-$$"
redis_container="hemia-payments-flow-redis-$$"
trap 'docker rm -f -v "$container" "$redis_container" >/dev/null 2>&1 || true' EXIT
docker run -d --rm --name "$container" -p 127.0.0.1::5432 -e POSTGRES_PASSWORD=isolated-test-only postgres:18.4 >/dev/null
for attempt in {1..60}; do
 if docker exec "$container" pg_isready -U postgres >/dev/null 2>&1; then break; fi
 sleep 1
done
docker run -d --rm --name "$redis_container" -p 127.0.0.1::6379 redis:8-alpine >/dev/null
for attempt in {1..60}; do
 if docker exec "$redis_container" redis-cli ping >/dev/null 2>&1; then break; fi
 sleep 1
done
for database in identity_flow legal_flow billing_flow balanz_flow; do docker exec "$container" createdb -U postgres "$database"; done
PAYMENTS_FLOW_REDIS_PORT="$(docker port "$redis_container" 6379/tcp | awk -F: '{print $NF}')" PAYMENTS_FLOW_TEST_PORT="$(docker port "$container" 5432/tcp | awk -F: '{print $NF}')" node "$identity_root/test/backend/integration/payments-flow.integration.cjs"
