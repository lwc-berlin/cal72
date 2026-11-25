import { expandOccurrences, hasScheduledSlot, localToInstant, scheduledLocal } from '../../recurrence/expand.mjs';
import { db } from './index';
import { Clubs, EventExceptions, Events } from './schema';
import { and, desc, eq, gte, inArray, lte, lt, isNull, isNotNull, sql } from 'drizzle-orm';

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
 // One-off listings never touch exceptions; series rows load theirs in a single query.
 const exceptionsBySeries = new Map<number, ExceptionRow[]>();
 const clubsById = new Map<number, { id: number; name: string; color: string | null }>();
 const seriesIds = rows.filter(row => row.recurrenceIntervalWeeks !== null).map(row => row.id);
 if (seriesIds.length > 0) {
  for (const exception of await db.select().from(EventExceptions).where(inArray(EventExceptions.seriesId, seriesIds))) {
   if (!isEffectiveException(exception)) continue;
   exceptionsBySeries.set(exception.seriesId, [...(exceptionsBySeries.get(exception.seriesId) ?? []), exception]);
  }
  if ([...exceptionsBySeries.values()].some(list => list.some(exception => exception.clubOverridden && exception.club !== null))) {
   for (const club of await db.select().from(Clubs)) clubsById.set(club.id, club);
  }
 }
 for (const row of rows) {
  const { recurrenceIntervalWeeks, recurrenceUntil, ...original } = row;
  if (recurrenceIntervalWeeks === null) {
   if (includeAllOneOffs) events.push(original);
   else {
    // Legacy one-offs use Berlin wall times. First fold instant; pre-gap offset.
    // Do not apply recurrence's date, duration, or nonexistent-time rules.
    const formatter = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
    const offset = (instant: number) => {
     const p = Object.fromEntries(formatter.formatToParts(new Date(instant)).map(part => [part.type, part.value]));
     return Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`) - instant;
    };
    const resolveOneOff = (value: string) => {
     const wall = Date.parse(value.slice(0, 19) + (value.length === 16 ? ':00' : '') + 'Z');
     if (!Number.isFinite(wall)) return NaN;
     const offsets = [...new Set([-2, -1, 0, 1, 2].map(day => offset(wall + day * 86400000)))];
     const candidates = offsets.map(o => wall - o).filter(instant => offset(instant) === wall - instant).sort((a, b) => a - b);
     return candidates[0] ?? wall - offset(wall - 2 * 86400000);
    };
    if (resolveOneOff(row.end) >= lower && resolveOneOff(row.start) <= upper) events.push(original);
   }
   continue;
  }
  try {
   const startDate = row.start.slice(0, 10);
   const endDate = row.end.slice(0, 10);
   const endDayOffset = (Date.parse(endDate + 'T00:00:00Z') - Date.parse(startDate + 'T00:00:00Z')) / 86400000;
   const schedule = {
    seriesId: String(row.id), startDate, startTime: row.start.slice(11, 16),
    endTime: row.end.slice(11, 16), endDayOffset, recurrenceIntervalWeeks, recurrenceUntil
   };
   const exceptions = new Map((exceptionsBySeries.get(row.id) ?? []).map(exception => [exception.scheduledDate, exception]));
   for (const occurrence of expandOccurrences(schedule, { from: lower, to: upper })) {
    // A changed or deleted slot is published below (or not at all), never twice.
    if (exceptions.has(occurrence.scheduledDate)) continue;
    events.push({ ...original, id: occurrence.id, seriesId: row.id,
     scheduledDate: occurrence.scheduledDate,
     start: new Date(occurrence.start).toISOString(), end: new Date(occurrence.end).toISOString() });
   }
   // A moved occurrence can leave the range its slot sits in, or enter it from outside.
   for (const exception of exceptions.values()) {
    if (exception.deleted || !hasScheduledSlot(schedule, exception.scheduledDate)) continue;
    const changed = exceptionEvent(original, schedule, exception, clubsById);
    if (Date.parse(changed.start) < upper && Date.parse(changed.end) > lower) events.push(changed);
   }
  } catch (error) {
   issues.push({ seriesId: row.id, message: error instanceof Error ? error.message : 'Expansion failed' });
  }
 }
 events.sort((a, b) => a.start.localeCompare(b.start));
 return { events, issues };
};

type ExceptionRow = typeof EventExceptions.$inferSelect;
type SeriesSchedule = Parameters<typeof expandOccurrences>[0];

/** True when the exception changes anything; an all-inherited row publishes and hides nothing. */
const isEffectiveException = (exception: ExceptionRow) =>
 exception.deleted || exception.title !== null || exception.description !== null ||
 exception.start !== null || exception.end !== null || exception.clubOverridden;

/** Stable identity of an occurrence: its series and ORIGINAL scheduled start. Exceptions never change it. */
const occurrenceId = (seriesId: number | string, scheduledDate: string, startTime: string) =>
 JSON.stringify([String(seriesId), scheduledDate + 'T' + startTime]);

/** Effective occurrence: inherited fields come from the series row, overridden fields from the exception. */
const exceptionEvent = <T extends { id: number; title: string; description: string; club: { id: number; name: string; color: string | null } | null }>(
 original: T, schedule: SeriesSchedule, exception: ExceptionRow,
 clubs: Map<number, { id: number; name: string; color: string | null }>
) => {
 const slot = scheduledLocal(schedule, exception.scheduledDate);
 const start = localToInstant(exception.start ?? slot.start);
 const end = localToInstant(exception.end ?? slot.end);
 if (start === undefined || end === undefined || end <= start) throw new RangeError('Changed occurrence has no valid local time');
 return {
  ...original,
  id: occurrenceId(original.id, exception.scheduledDate, schedule.startTime), seriesId: original.id,
  scheduledDate: exception.scheduledDate,
  title: exception.title ?? original.title,
  description: exception.description ?? original.description,
  club: exception.clubOverridden ? (exception.club === null ? null : clubs.get(exception.club) ?? null) : original.club,
  start: new Date(start).toISOString(), end: new Date(end).toISOString()
 };
};

/** Resolve only canonical scheduled-slot tuples, never numeric prefixes. */
const parseOccurrenceId = (id: string) => {
 let tuple: unknown;
 try { tuple = JSON.parse(id); } catch { return undefined; }
 if (!Array.isArray(tuple) || tuple.length !== 2 || JSON.stringify(tuple) !== id ||
  typeof tuple[0] !== 'string' || !/^[1-9]\d*$/.test(tuple[0]) ||
  typeof tuple[1] !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(tuple[1])) return undefined;
 return { seriesId: tuple[0], scheduledDate: tuple[1].slice(0, 10), startTime: tuple[1].slice(11) };
};

const scheduleOf = (series: { id: number; start: string; end: string; recurrenceIntervalWeeks: number | null; recurrenceUntil: string | null }): SeriesSchedule => ({
 seriesId: String(series.id), startDate: series.start.slice(0, 10), startTime: series.start.slice(11, 16),
 endTime: series.end.slice(11, 16),
 endDayOffset: (Date.parse(series.end.slice(0, 10) + 'T00:00:00Z') - Date.parse(series.start.slice(0, 10) + 'T00:00:00Z')) / 86400000,
 recurrenceIntervalWeeks: series.recurrenceIntervalWeeks!, recurrenceUntil: series.recurrenceUntil
});

const findException = async (seriesId: number, scheduledDate: string) =>
 (await db.select().from(EventExceptions)
  .where(and(eq(EventExceptions.seriesId, seriesId), eq(EventExceptions.scheduledDate, scheduledDate))))[0];

/** Series, slot and any exception for a canonical occurrence id; undefined when it is not a live slot. */
const resolveOccurrence = async (id: string) => {
 const parsed = parseOccurrenceId(id);
 if (!parsed) return undefined;
 const series = await getEvent(parsed.seriesId);
 if (!series || series.deletedAt || series.recurrenceIntervalWeeks === null) return undefined;
 const schedule = scheduleOf(series);
 if (parsed.startTime !== schedule.startTime || !hasScheduledSlot(schedule, parsed.scheduledDate)) return undefined;
 const exception = await findException(series.id, parsed.scheduledDate);
 if (exception?.deleted) return undefined;
 return { series, schedule, scheduledDate: parsed.scheduledDate, exception };
};

export const getWebEvent = async (id: string) => {
 if (/^[1-9]\d*$/.test(id)) return getEvent(id);
 const found = await resolveOccurrence(id);
 if (!found) return undefined;
 const { series, schedule, scheduledDate, exception } = found;
 const slot = scheduledLocal(schedule, scheduledDate);
 const clubs = new Map<number, { id: number; name: string; color: string | null }>();
 const changed = exception && isEffectiveException(exception)
  ? exceptionEvent({ ...series, club: null }, schedule, exception, clubs) : undefined;
 const start = changed?.start ?? new Date(localToInstant(slot.start)!).toISOString();
 const end = changed?.end ?? new Date(localToInstant(slot.end)!).toISOString();
 return {
  ...series,
  id, seriesId: series.id, scheduledDate,
  title: exception?.title ?? series.title,
  description: exception?.description ?? series.description,
  club: exception?.clubOverridden ? exception.club : series.club,
  start, end,
  // Berlin wall-clock text for forms, which must not round-trip through UTC.
  localStart: exception?.start ?? slot.start,
  localEnd: exception?.end ?? slot.end
 };
};

export type OccurrenceChanges = {
 title: string;
 description: string;
 start: string;
 end: string;
 club: number | null;
};

/**
 * Store only the fields that differ from what the series gives this slot, so every other
 * field keeps inheriting later series updates. A previously stored exception whose fields
 * all return to the inherited values is kept (with a higher sequence) so subscribers see
 * the revert; it publishes and hides nothing.
 */
export const updateOccurrence = async (id: string, data: OccurrenceChanges) => {
 const found = await resolveOccurrence(id);
 if (!found) throw new Error('Occurrence not found');
 const { series, schedule, scheduledDate } = found;
 const start = localToInstant(data.start);
 const end = localToInstant(data.end);
 if (start === undefined || end === undefined) throw new RangeError('Start and end must be existing Berlin local times');
 if (start >= end) throw new RangeError('Start date must be before end date');
 const slot = scheduledLocal(schedule, scheduledDate);
 const overrides = {
  title: data.title !== series.title ? data.title : null,
  description: data.description !== series.description ? data.description : null,
  start: data.start !== slot.start ? data.start : null,
  end: data.end !== slot.end ? data.end : null,
  clubOverridden: data.club !== series.club,
  club: data.club !== series.club ? data.club : null
 };
 const inheritsEverything = Object.values(overrides).every(value => value === null || value === false);
 const revision = { sequence: sql`${EventExceptions.sequence} + 1`, updatedAt: new Date() };
 if (inheritsEverything) {
  const [reverted] = await db.update(EventExceptions).set({ ...overrides, deleted: false, ...revision })
   .where(and(eq(EventExceptions.seriesId, series.id), eq(EventExceptions.scheduledDate, scheduledDate))).returning();
  return reverted;
 }
 const [saved] = await db.insert(EventExceptions).values({ seriesId: series.id, scheduledDate, ...overrides })
  .onConflictDoUpdate({ target: [EventExceptions.seriesId, EventExceptions.scheduledDate], set: { ...overrides, deleted: false, ...revision } })
  .returning();
 return saved;
};

/** Individual deletion works for past and future slots and never touches other slots. */
export const deleteOccurrence = async (id: string) => {
 const found = await resolveOccurrence(id);
 if (!found) throw new Error('Occurrence not found');
 const { series, scheduledDate } = found;
 const [saved] = await db.insert(EventExceptions).values({ seriesId: series.id, scheduledDate, deleted: true })
  .onConflictDoUpdate({ target: [EventExceptions.seriesId, EventExceptions.scheduledDate],
   set: { deleted: true, sequence: sql`${EventExceptions.sequence} + 1`, updatedAt: new Date() } })
  .returning();
 return saved;
};

/** Exceptions for subscription publication, with the overriding club's name resolved. */
export const getFeedExceptions = async () => db.select({
 seriesId: EventExceptions.seriesId,
 scheduledDate: EventExceptions.scheduledDate,
 deleted: EventExceptions.deleted,
 title: EventExceptions.title,
 description: EventExceptions.description,
 start: EventExceptions.start,
 end: EventExceptions.end,
 clubOverridden: EventExceptions.clubOverridden,
 clubName: Clubs.name,
 sequence: EventExceptions.sequence,
 updatedAt: EventExceptions.updatedAt
}).from(EventExceptions).leftJoin(Clubs, eq(EventExceptions.club, Clubs.id));

/** Raw anchors for subscription publication; never expand into duplicate VEVENTs. */
export const getFeedSeries = async () => db.select({ ...eventSelect,
 recurrenceIntervalWeeks: Events.recurrenceIntervalWeeks,
 recurrenceUntil: Events.recurrenceUntil
}).from(Events).leftJoin(Clubs, eq(Events.club, Clubs.id))
 .where(isNotNull(Events.recurrenceIntervalWeeks));
