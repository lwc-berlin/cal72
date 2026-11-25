#!/usr/bin/env bash
set -euo pipefail
container="cal72-public-tests-$$"
cleanup() { docker rm -f "$container" >/dev/null; }
trap cleanup EXIT
docker run -d --name "$container" -e POSTGRES_PASSWORD=synthetic-test-only -e POSTGRES_DB=cal72_test -p 127.0.0.1:55432:5432 postgres:17-alpine >/dev/null
ready=false
for attempt in {1..30}; do
	if docker exec "$container" pg_isready -h 127.0.0.1 -U postgres -d cal72_test >/dev/null 2>&1; then ready=true; break; fi
	sleep 1
done
"$ready" || { echo 'PostgreSQL TCP server did not become ready after 30 attempts' >&2; exit 1; }
for migration in drizzle/*.sql; do
	docker exec -i "$container" psql -h 127.0.0.1 -v ON_ERROR_STOP=1 -U postgres -d cal72_test < "$migration"
done
pnpm exec playwright test "$@"
