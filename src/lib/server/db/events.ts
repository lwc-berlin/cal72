import { expandOccurrences } from '../../recurrence/expand.mjs';
import { db } from './index';
import { Clubs, Events } from './schema';
import { and, desc, eq, gte, lte, lt, isNull, isNotNull, sql } from 'drizzle-orm';

type CreateEvent = typeof Events.$inferInsert;
type UpdateEvent = {
	id: string;
	title: string;
	description: string;
	start: string;
	end: string;
	club: number | null;
};
type CreateClub = typeof Clubs.$inferInsert;
type UpdateClub = { id: string; name: string; color: string | null };

const eventSelect = {
	id: Events.id,
	title: Events.title,
	description: Events.description,
	start: Events.start,
	end: Events.end,
	club: {
		id: Clubs.id,
		name: Clubs.name,
		color: Clubs.color
	},
	createdAt: Events.createdAt,
	updatedAt: Events.updatedAt,
	sequence: Events.sequence,
	deletedAt: Events.deletedAt
};

export const getAllEvents = async (from?: Date, to?: Date, includeDeleted = false) => {
	console.log('Fetching events from the database');
	const conditions = [];
	if (from) conditions.push(gte(Events.end, from.toISOString()));
	if (to) conditions.push(lte(Events.start, to.toISOString()));
	if (!includeDeleted) conditions.push(isNull(Events.deletedAt));
	const events = await db
		.select(eventSelect)
		.from(Events)
		.leftJoin(Clubs, eq(Events.club, Clubs.id))
		.where(conditions.length > 0 ? and(...conditions) : undefined)
		.orderBy(Events.start);
	console.log('Fetched events:', events.length);
	return events;
};

export const getFutureEvents = async () => {
	const now = new Date().toISOString();
	return await db
		.select(eventSelect)
		.from(Events)
		.leftJoin(Clubs, eq(Events.club, Clubs.id))
		.where(and(gte(Events.end, now), isNull(Events.deletedAt)))
		.orderBy(Events.start);
};

export const getPastEvents = async () => {
	const now = new Date().toISOString();
	return await db
		.select(eventSelect)
		.from(Events)
		.leftJoin(Clubs, eq(Events.club, Clubs.id))
		.where(and(lt(Events.end, now), isNull(Events.deletedAt)))
		.orderBy(desc(Events.start));
};

export const getEvent = async (id: string) => {
	console.log(`Fetching event with id: ${id}`);
	if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) return undefined;
	const events = await db
		.select()
		.from(Events)
		.where(eq(Events.id, parseInt(id)));
	const event = events[0];
	console.log('Fetched event:', event);
	return event;
};

export const createEvent = async (data: CreateEvent) => {
	const result = await db.insert(Events).values(data).returning();
	return result[0];
};

export const getAllClubs = async () => {
	console.log('Fetching all clubs from the database');
	const clubs = await db.select().from(Clubs);
	console.log('Fetched clubs:', clubs);
	return clubs;
};

export const getClub = async (id: string) => {
	console.log(`Fetching event with id: ${id}`);
	const clubs = await db
		.select()
		.from(Clubs)
		.where(eq(Clubs.id, parseInt(id)));
	const club = clubs[0];
	console.log('Fetched event:', club);
	return club;
};

export const createClub = async (data: CreateClub) => {
	const result = await db.insert(Clubs).values(data).returning();
	return result[0];
};

export const updateClub = async (data: UpdateClub) => {
	const result = await db
		.update(Clubs)
		.set({ name: data.name, color: data.color })
		.where(eq(Clubs.id, parseInt(data.id)))
		.returning();
	return result[0];
};

export const deleteClub = async (id: number) => {
	const result = await db.delete(Clubs).where(eq(Clubs.id, id)).returning();
	return result[0];
};

export const updateEvent = async (data: UpdateEvent) => {
	const existing = await getEvent(data.id);
	if (!existing || existing.recurrenceIntervalWeeks !== null) throw new Error("Unsupported recurring mutation or invalid id");
	const result = await db
		.update(Events)
		.set({
			title: data.title,
			description: data.description,
			start: data.start,
			end: data.end,
			club: data.club,
			sequence: sql`${Events.sequence} + 1`
		})
		.where(and(eq(Events.id, Number(data.id)), isNull(Events.recurrenceIntervalWeeks)))
		.returning();
	return result[0];
};

export const deleteEvent = async (id: number) => {
	if (!Number.isSafeInteger(id) || id < 1) throw new Error("Invalid event id");
	const result = await db
		.update(Events)
		.set({
			deletedAt: new Date(),
			sequence: sql`${Events.sequence} + 1`
		})
		.where(and(eq(Events.id, id), isNull(Events.recurrenceIntervalWeeks)))
		.returning();
	return result[0];
};

export const pruneDeletedEvents = async (olderThanDays = 180) => {
	const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
	const result = await db
		.delete(Events)
		.where(and(isNotNull(Events.deletedAt), lt(Events.end, cutoff.toISOString())))
		.returning();
	return result.length;
};

/** Separate from raw ICS queries. Defaults cover one year either side of now.
 * One-offs retain their original shape. Series failures are explicit diagnostics,
 * not a policy decision to skip an invalid local END or to shift its time.
 * Consumers MUST expose issues before using this as a complete event listing.
 */
export const getWebOccurrences = async (
 from?: Date,
 to?: Date
) => {
 const includeAllOneOffs = from === undefined && to === undefined;
 from ??= new Date(Date.now() - 366 * 86400000);
 to ??= new Date(Date.now() + 366 * 86400000);
 const lower = from.getTime(), upper = to.getTime();
 if (!Number.isFinite(lower) || !Number.isFinite(upper) || lower >= upper || upper - lower > 3660 * 86400000) {
  throw new RangeError('Finite ordered range of at most 3660 days required');
 }
 // Do not filter by anchor end: an old series can still have visible slots.
 const rows = await db.select({ ...eventSelect,
  recurrenceIntervalWeeks: Events.recurrenceIntervalWeeks,
  recurrenceUntil: Events.recurrenceUntil
 }).from(Events).leftJoin(Clubs, eq(Events.club, Clubs.id))
  .where(isNull(Events.deletedAt));
 type Row = Awaited<ReturnType<typeof getAllEvents>>[number];
 const events: (Row | (Omit<Row, 'id'> & { id: string; seriesId: number; scheduledDate: string }))[] = [];
 const issues: { seriesId: number; message: string }[] = [];
 for (const row of rows) {
  const { recurrenceIntervalWeeks, recurrenceUntil, ...original } = row;
  if (recurrenceIntervalWeeks === null) {
   if (includeAllOneOffs || (row.start <= to.toISOString() && row.end >= from.toISOString())) events.push(original);
   continue;
  }
  try {
   const startDate = row.start.slice(0, 10);
   const endDate = row.end.slice(0, 10);
   const endDayOffset = (Date.parse(endDate + 'T00:00:00Z') - Date.parse(startDate + 'T00:00:00Z')) / 86400000;
   for (const occurrence of expandOccurrences({
    seriesId: String(row.id), startDate, startTime: row.start.slice(11, 16),
    endTime: row.end.slice(11, 16), endDayOffset, recurrenceIntervalWeeks, recurrenceUntil
   }, { from: lower, to: upper })) {
    events.push({ ...original, id: occurrence.id, seriesId: row.id,
     scheduledDate: occurrence.scheduledDate,
     start: new Date(occurrence.start).toISOString(), end: new Date(occurrence.end).toISOString() });
   }
  } catch (error) {
   issues.push({ seriesId: row.id, message: error instanceof Error ? error.message : 'Expansion failed' });
  }
 }
 events.sort((a, b) => a.start.localeCompare(b.start));
 return { events, issues };
};

/** Resolve only canonical scheduled-slot tuples, never numeric prefixes. */
export const getWebEvent = async (id: string) => {
 if (/^[1-9]\d*$/.test(id)) return getEvent(id);
 let tuple: unknown;
 try { tuple = JSON.parse(id); } catch { return undefined; }
 if (!Array.isArray(tuple) || tuple.length !== 2 || JSON.stringify(tuple) !== id ||
  typeof tuple[0] !== 'string' || !/^[1-9]\d*$/.test(tuple[0]) ||
  typeof tuple[1] !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(tuple[1])) return undefined;
 const series = await getEvent(tuple[0]);
 if (!series || series.deletedAt || series.recurrenceIntervalWeeks === null) return undefined;
 const day = Date.parse(tuple[1].slice(0, 10) + 'T00:00:00Z');
 if (!Number.isFinite(day)) return undefined;
 const result = await getWebOccurrences(new Date(day - 367 * 86400000), new Date(day + 367 * 86400000));
 const occurrence = result.events.find(event => event.id === id);
 return occurrence ? { ...series, ...occurrence, club: series.club } : undefined;
};

/** Raw anchors for subscription publication; never expand into duplicate VEVENTs. */
export const getFeedSeries = async () => db.select({ ...eventSelect,
 recurrenceIntervalWeeks: Events.recurrenceIntervalWeeks,
 recurrenceUntil: Events.recurrenceUntil
}).from(Events).leftJoin(Clubs, eq(Events.club, Clubs.id))
 .where(isNotNull(Events.recurrenceIntervalWeeks));
