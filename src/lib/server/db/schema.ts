import { sql } from 'drizzle-orm';
import { check, date, integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

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
