#!/usr/bin/env bash
# Synthetic PostgreSQL only; no host ports, application configuration or credentials.
set -euo pipefail
cd "$(dirname "$0")/.."
container="cal72-recurrence-migration-$$"
trap 'docker rm -f "$container" >/dev/null 2>&1 || true' EXIT
docker run -d --name "$container" -e POSTGRES_PASSWORD=synthetic-test-only postgres:17-alpine >/dev/null
ready=false
for attempt in {1..30}; do
	if docker exec "$container" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; then ready=true; break; fi
	sleep 1
done
"$ready" || { echo 'PostgreSQL TCP server did not become ready after 30 attempts' >&2; exit 1; }
psql() { docker exec -i "$container" psql -h 127.0.0.1 -X -v ON_ERROR_STOP=1 -U postgres "$@"; }
for migration in drizzle/000{0,1,2}_*.sql; do psql < "$migration"; done
psql <<'SQL'
INSERT INTO events (title, start_time, end_time, sequence) VALUES
 ('Existing overnight', '2026-07-01T23:00', '2026-07-02T01:00', 7),
 ('Legacy text', 'legacy start', 'legacy end', 0);
CREATE TABLE before_migration AS SELECT to_jsonb(events) AS row FROM events;
SQL
# Missing migration must fail in the RED phase, rather than silently skipping it.
psql < drizzle/0003_recurrence.sql
psql <<'SQL'
DO $$
DECLARE candidate integer;
BEGIN
 IF EXISTS (
   SELECT 1 FROM events e JOIN before_migration b ON (b.row->>'id')::integer = e.id
   WHERE to_jsonb(e) - 'recurrence_interval_weeks' - 'recurrence_until' <> b.row
      OR e.recurrence_interval_weeks IS NOT NULL OR e.recurrence_until IS NOT NULL
 ) OR (SELECT count(*) FROM events) <> 2 THEN
   RAISE EXCEPTION 'Existing records changed';
 END IF;
 INSERT INTO events (start_time, end_time) VALUES ('2026-07-01T19:00', '2026-07-01T20:00');
 IF EXISTS (SELECT 1 FROM events WHERE recurrence_interval_weeks IS NOT NULL OR recurrence_until IS NOT NULL) THEN
   RAISE EXCEPTION 'One-off defaults changed';
 END IF;
 UPDATE events SET recurrence_interval_weeks = 2, recurrence_until = '2026-07-01' WHERE id = 1;
 UPDATE events SET recurrence_until = NULL WHERE id = 1;
 UPDATE events SET recurrence_until = '2026-07-15' WHERE id = 1;
 FOREACH candidate IN ARRAY ARRAY[0, -1] LOOP
   BEGIN
     UPDATE events SET recurrence_interval_weeks = candidate WHERE id = 1;
     RAISE EXCEPTION 'Invalid interval accepted';
   EXCEPTION WHEN check_violation THEN NULL;
   END;
 END LOOP;
 BEGIN
   UPDATE events SET recurrence_until = '2026-06-30' WHERE id = 1;
   RAISE EXCEPTION 'Early end date accepted';
 EXCEPTION WHEN check_violation THEN NULL;
 END;
 BEGIN
   UPDATE events SET recurrence_interval_weeks = NULL WHERE id = 1;
   RAISE EXCEPTION 'End date without recurrence accepted';
 EXCEPTION WHEN check_violation THEN NULL;
 END;
 IF NOT EXISTS (SELECT 1 FROM events WHERE id = 1 AND recurrence_interval_weeks = 2 AND recurrence_until = '2026-07-15') THEN
   RAISE EXCEPTION 'Rejected updates changed stored recurrence';
 END IF;
END $$;
SQL
# Ticket 02: the exceptions migration is purely additive over populated data.
psql <<'SQL'
CREATE TABLE before_exceptions AS SELECT to_jsonb(events) AS row FROM events;
SQL
psql < drizzle/0004_occurrence_exceptions.sql
psql <<'SQL'
DO $$
BEGIN
 IF EXISTS (
   SELECT 1 FROM events e JOIN before_exceptions b ON (b.row->>'id')::integer = e.id WHERE to_jsonb(e) <> b.row
 ) OR (SELECT count(*) FROM events) <> (SELECT count(*) FROM before_exceptions) THEN
   RAISE EXCEPTION 'Exceptions migration changed existing events';
 END IF;
 INSERT INTO event_exceptions (series_id, scheduled_date, title) VALUES (1, '2026-07-08', 'Special');
 IF NOT EXISTS (SELECT 1 FROM event_exceptions WHERE deleted = false AND club_overridden = false AND sequence = 1 AND description IS NULL) THEN
   RAISE EXCEPTION 'Exception defaults must inherit every other field';
 END IF;
 BEGIN
   INSERT INTO event_exceptions (series_id, scheduled_date, deleted) VALUES (1, '2026-07-08', true);
   RAISE EXCEPTION 'Duplicate slot accepted';
 EXCEPTION WHEN unique_violation THEN NULL;
 END;
 BEGIN
   INSERT INTO event_exceptions (series_id, scheduled_date) VALUES (9999, '2026-07-08');
   RAISE EXCEPTION 'Exception for a missing series accepted';
 EXCEPTION WHEN foreign_key_violation THEN NULL;
 END;
 DELETE FROM events WHERE id = 1;
 IF EXISTS (SELECT 1 FROM event_exceptions) THEN
   RAISE EXCEPTION 'Exceptions must follow their series';
 END IF;
END $$;
SQL
echo 'PASS: migration preserves existing rows/defaults; valid recurrence accepted; invalid updates rejected atomically'
echo 'PASS: exceptions migration is additive; one change per slot; cascades with its series'
