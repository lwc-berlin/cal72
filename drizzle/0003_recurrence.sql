ALTER TABLE "events" ADD COLUMN "recurrence_interval_weeks" integer;
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "recurrence_until" date;
--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_recurrence_interval_check" CHECK ("recurrence_interval_weeks" IS NULL OR "recurrence_interval_weeks" > 0);
--> statement-breakpoint
-- CASE leaves legacy one-off start strings untouched. The end date bounds
-- occurrence starts, not ends, so overnight final occurrences remain valid.
ALTER TABLE "events" ADD CONSTRAINT "events_recurrence_until_check" CHECK (CASE WHEN "recurrence_until" IS NULL THEN true WHEN "recurrence_interval_weeks" IS NULL THEN false ELSE "recurrence_until" >= left("start_time", 10)::date END);
