import { sql } from 'drizzle-orm';
import { boolean, check, date, integer, pgTable, serial, text, timestamp, unique } from 'drizzle-orm/pg-core';

export const Events = pgTable('events', {
	id: serial('id').primaryKey().notNull(),
	title: text('title').notNull().default(''),
	description: text('description').notNull().default(''),
	start: text('start_time').notNull(),
	end: text('end_time').notNull(),
	club: integer('club').references(() => Clubs.id, { onDelete: 'set null' }),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
	sequence: integer('sequence').notNull().default(0),
	deletedAt: timestamp('deleted_at'),
	recurrenceIntervalWeeks: integer('recurrence_interval_weeks'),
	recurrenceUntil: date('recurrence_until')
}, (table) => ({
	recurrenceInterval: check('events_recurrence_interval_check', sql`${table.recurrenceIntervalWeeks} IS NULL OR ${table.recurrenceIntervalWeeks} > 0`),
	recurrenceUntil: check('events_recurrence_until_check', sql`CASE WHEN ${table.recurrenceUntil} IS NULL THEN true WHEN ${table.recurrenceIntervalWeeks} IS NULL THEN false ELSE ${table.recurrenceUntil} >= left(${table.start}, 10)::date END`)
}));

export const Clubs = pgTable('clubs', {
	id: serial('id').primaryKey().notNull(),
	name: text('name').notNull().default(''),
	color: text('color')
});

/**
 * Individual changes to one occurrence of a series, keyed by its original scheduled
 * date. Null columns inherit from the series; `club_overridden` distinguishes an
 * inherited club from an explicit "no club".
 */
export const EventExceptions = pgTable('event_exceptions', {
	id: serial('id').primaryKey().notNull(),
	seriesId: integer('series_id').notNull().references(() => Events.id, { onDelete: 'cascade' }),
	scheduledDate: date('scheduled_date').notNull(),
	deleted: boolean('deleted').notNull().default(false),
	title: text('title'),
	description: text('description'),
	start: text('start_time'),
	end: text('end_time'),
	clubOverridden: boolean('club_overridden').notNull().default(false),
	club: integer('club').references(() => Clubs.id, { onDelete: 'set null' }),
	sequence: integer('sequence').notNull().default(1),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow()
}, (table) => ({
	slot: unique('event_exceptions_slot_unique').on(table.seriesId, table.scheduledDate)
}));
