#!/usr/bin/env bash
set -euo pipefail
identity_root="$(cd "$(dirname "$0")/../../.." && pwd)"
suites=(seed-clients scope-catalog service-destinations unique-scope-catalog)
if [[ "${1:-all}" != all ]]; then
  case "$1" in seed-clients|scope-catalog|service-destinations|unique-scope-catalog) suites=("$1");; *) echo 'Unknown integration suite' >&2; exit 2;; esac
fi
container=''
cleanup() { if [[ -n "$container" ]]; then docker rm -f -v "$container" >/dev/null 2>&1 || true; fi; }
trap cleanup EXIT
for suite in "${suites[@]}"; do
  container="identity-${suite}-test-$$"
  database=identity_destinations_test
  if [[ "$suite" == seed-clients ]]; then database=identity_seed_test; fi
  docker run -d --rm --name "$container" -p 127.0.0.1::5432 \
    -e POSTGRES_PASSWORD=isolated-test-only -e "POSTGRES_DB=$database" postgres:18.4 >/dev/null
  ready=false
  for attempt in {1..60}; do
    if docker exec "$container" pg_isready -h 127.0.0.1 -U postgres -d "$database" >/dev/null 2>&1; then ready=true; break; fi
    sleep 1
  done
  [[ "$ready" == true ]] || { echo 'Disposable PostgreSQL did not start' >&2; exit 1; }
  port="$(docker port "$container" 5432/tcp | awk -F: '{print $NF}')"
  IDENTITY_ISOLATED_DATABASE=1 SEED_TEST_DATABASE_PORT="$port" OAUTH_DESTINATION_TEST_PORT="$port" \
    node "$identity_root/test/backend/integration/$suite.integration.cjs"
  cleanup
  container=''
done
