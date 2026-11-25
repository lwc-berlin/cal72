CREATE TABLE "event_exceptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"series_id" integer NOT NULL,
	"scheduled_date" date NOT NULL,
	"deleted" boolean DEFAULT false NOT NULL,
	"title" text,
	"description" text,
	"start_time" text,
	"end_time" text,
	"club_overridden" boolean DEFAULT false NOT NULL,
	"club" integer,
	"sequence" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "event_exceptions_slot_unique" UNIQUE("series_id","scheduled_date")
);
--> statement-breakpoint
ALTER TABLE "event_exceptions" ADD CONSTRAINT "event_exceptions_series_id_events_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_exceptions" ADD CONSTRAINT "event_exceptions_club_clubs_id_fk" FOREIGN KEY ("club") REFERENCES "public"."clubs"("id") ON DELETE set null ON UPDATE no action;