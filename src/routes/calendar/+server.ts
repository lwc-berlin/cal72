import { expandOccurrences, hasScheduledSlot, scheduledLocal } from '$lib/recurrence/expand.mjs';
import { getAllEvents, getFeedExceptions, getFeedSeries, pruneDeletedEvents } from '$lib/server/db/events';
import type { RequestHandler } from '@sveltejs/kit';

type FeedException = Awaited<ReturnType<typeof getFeedExceptions>>[number];
type CalendarEvent = Awaited<ReturnType<typeof getAllEvents>>[number] & {
	recurrenceIntervalWeeks?: number | null;
	recurrenceUntil?: string | null;
	exceptions?: FeedException[];
};

const PRUNE_INTERVAL_MS = 60 * 60 * 1000;
let lastPruneAt = 0;

export const GET: RequestHandler = async ({ request }) => {
	const now = new Date();

	if (now.getTime() - lastPruneAt > PRUNE_INTERVAL_MS) {
		lastPruneAt = now.getTime();
		pruneDeletedEvents().catch((err) => console.error('prune failed:', err));
	}

	// Rolling window: 180 days past to 365 days future
	const rangeStart = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
	const rangeEnd = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

	const [raw, series, exceptionRows] = await Promise.all([
  getAllEvents(rangeStart, rangeEnd, true), getFeedSeries(), getFeedExceptions()
 ]);
 const ids = new Set(series.map(event => event.id));
 const events: CalendarEvent[] = raw.filter(event => !ids.has(event.id));
 for (const event of series) {
  const exceptions = exceptionRows.filter(row => row.seriesId === event.id);
  // A series stays published when an exception may move an occurrence into the window.
  if (expandOccurrences(schedule(event), { from: +rangeStart, to: +rangeEnd }).length || exceptions.length) {
   events.push({ ...event, exceptions });
  }
 }

	let lastModified = 0;
	for (const e of events) {
		const t = new Date(e.deletedAt || e.updatedAt || e.createdAt).getTime();
		if (t > lastModified) lastModified = t;
		for (const exception of e.exceptions ?? []) {
			const exceptionTime = new Date(exception.updatedAt).getTime();
			if (exceptionTime > lastModified) lastModified = exceptionTime;
		}
	}
	// HTTP dates have 1-second precision; truncate so the emitted
	// Last-Modified header and the If-Modified-Since comparison stay consistent.
	lastModified = Math.floor(lastModified / 1000) * 1000;
	const lastModifiedDate = new Date(lastModified);

	const body = generateICal(lastModifiedDate, events, rangeStart, rangeEnd);
	const etag = `"${await sha1Hex(body)}"`;

	const ifNoneMatch = request.headers.get('if-none-match');
	if (ifNoneMatch === etag) {
		return new Response(null, {
			status: 304,
			headers: { ETag: etag, 'Last-Modified': lastModifiedDate.toUTCString() }
		});
	}
	const ifModifiedSince = request.headers.get('if-modified-since');
	if (!series.length && !ifNoneMatch && ifModifiedSince && new Date(ifModifiedSince).getTime() >= lastModified) {
		return new Response(null, {
			status: 304,
			headers: { ETag: etag, 'Last-Modified': lastModifiedDate.toUTCString() }
		});
	}

	return new Response(body, {
		headers: {
			'Content-Type': 'text/calendar; charset=utf-8',
			'Cache-Control': 'private, max-age=300',
			'Content-Disposition': 'inline; filename="cal72.ics"',
			'X-Published-TTL': 'PT15M',
			ETag: etag,
			'Last-Modified': lastModifiedDate.toUTCString()
		}
	});
};

async function sha1Hex(text: string): Promise<string> {
	const data = new TextEncoder().encode(text);
	const digest = await crypto.subtle.digest('SHA-1', data);
	return Array.from(new Uint8Array(digest))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

// Helper function to format Date to iCal format (YYYYMMDDTHHMMSSZ)
function formatICalTimestamp(date: Date): string {
	return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

// Berlin's offset at the end of the selected local date determines the UTC cutoff.
function berlinEndOfDay(date: string): Date {
 const wall = Date.parse(date + 'T23:59:59Z');
 const parts = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Berlin', timeZoneName: 'shortOffset'
 }).formatToParts(wall);
 const offset = parts.find(part => part.type === 'timeZoneName')!.value;
 const hours = Number(offset.replace('GMT', ''));
 return new Date(wall - hours * 3600000);
}

// Fold long lines per RFC 5545 §3.1 (max 75 octets per line)
function foldLine(line: string): string {
	const encoder = new TextEncoder();
	if (encoder.encode(line).length <= 75) return line;

	const chunks: string[] = [];
	let current = '';
	for (const char of line) {
		const candidate = current + char;
		if (encoder.encode(candidate).length > (chunks.length === 0 ? 75 : 74)) {
			chunks.push(current);
			current = ' ' + char;
		} else {
			current = candidate;
		}
	}
	if (current) chunks.push(current);
	return chunks.join('\r\n');
}

// Helper function to escape special characters per RFC 5545
function escapeICalText(text: string): string {
	if (!text) return '';
	return text
		.replace(/\r\n/g, '\n') // Normalize CRLF to LF first
		.replace(/\r/g, '\n') // Normalize lone CR to LF
		.replace(/\\/g, '\\\\') // Backslash must be escaped before we add our own
		.replace(/;/g, '\\;') // Semicolon
		.replace(/,/g, '\\,') // Comma
		.replace(/\n/g, '\\n'); // Newline (now only LF remains, no stray CR)
}

// Format datetime string for iCalendar (local time without conversion)
function formatDateTime(dateStr: string): string | null {
	const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
	if (!match) return null;

	const [, year, month, day, hours, minutes, seconds] = match;
	const sec = seconds || '00';
	return `${year}${month}${day}T${hours}${minutes}${sec}`;
}

function schedule(event: CalendarEvent) {
 return { seriesId: String(event.id), startDate: event.start.slice(0,10),
 startTime: event.start.slice(11,16), endTime: event.end.slice(11,16),
 endDayOffset: (Date.parse(event.end.slice(0,10)) - Date.parse(event.start.slice(0,10))) / 86400000,
 recurrenceIntervalWeeks: event.recurrenceIntervalWeeks!, recurrenceUntil: event.recurrenceUntil ?? null };
}

// One RECURRENCE-ID instance per individually changed or deleted occurrence. Moved and
// edited instances publish the effective fields; deleted instances stay as cancelled
// instances so subscribers get cancellation metadata rather than a silent omission.
// SEQUENCE adds the exception's own counter to the series' so either change is monotonic.
function exceptionInstances(event: CalendarEvent, rangeStart: Date, rangeEnd: Date): string[] {
 const spec = schedule(event);
 const lines: string[] = [];
 for (const exception of event.exceptions ?? []) {
  const changed = exception.deleted || exception.title !== null || exception.description !== null ||
   exception.start !== null || exception.end !== null || exception.clubOverridden;
  if (!changed || !hasScheduledSlot(spec, exception.scheduledDate)) continue;
  const slot = scheduledLocal(spec, exception.scheduledDate);
  const start = exception.deleted ? slot.start : exception.start ?? slot.start;
  const end = exception.deleted ? slot.end : exception.end ?? slot.end;
  const slack = 2 * 86400000;
  const inWindow = (value: string) => Date.parse(value + ':00Z') >= +rangeStart - slack && Date.parse(value + ':00Z') <= +rangeEnd + slack;
  if (!inWindow(slot.start) && !inWindow(start)) continue;
  const clubName = exception.clubOverridden ? exception.clubName : event.club?.name ?? null;
  const updated = formatICalTimestamp(new Date(exception.updatedAt));
  lines.push('BEGIN:VEVENT', `UID:${event.id}@cal72`, `DTSTAMP:${updated}`,
   `SEQUENCE:${(event.sequence || 0) + exception.sequence}`, `LAST-MODIFIED:${updated}`);
  if (exception.deleted) lines.push('STATUS:CANCELLED');
  lines.push(`RECURRENCE-ID;TZID=Europe/Berlin:${exception.scheduledDate.replaceAll('-', '')}T${spec.startTime.replace(':', '')}00`,
   `DTSTART;TZID=Europe/Berlin:${formatDateTime(start)}`, `DTEND;TZID=Europe/Berlin:${formatDateTime(end)}`,
   `SUMMARY:${escapeICalText(exception.title ?? event.title)}${clubName ? ' [' + escapeICalText(clubName) + ']' : ''}`,
   `DESCRIPTION:${escapeICalText(exception.description ?? event.description)}`, 'END:VEVENT');
 }
 return lines;
}

function generateICal(stamp: Date, events: CalendarEvent[], rangeStart: Date, rangeEnd: Date) {
	const lines = [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'PRODID:-//CAL72//CAL72//EN',
		'METHOD:PUBLISH',
		'CALSCALE:GREGORIAN',
		'X-WR-CALNAME:CAL72',
		'X-WR-TIMEZONE:Europe/Berlin',
		'X-WR-CALDESC:CAL72',
		`DTSTAMP:${formatICalTimestamp(stamp)}`,
		'BEGIN:VTIMEZONE',
		'TZID:Europe/Berlin',
		'BEGIN:DAYLIGHT',
		'TZOFFSETFROM:+0100',
		'TZOFFSETTO:+0200',
		'TZNAME:CEST',
		'DTSTART:19700329T020000',
		'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
		'END:DAYLIGHT',
		'BEGIN:STANDARD',
		'TZOFFSETFROM:+0200',
		'TZOFFSETTO:+0100',
		'TZNAME:CET',
		'DTSTART:19701025T030000',
		'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
		'END:STANDARD',
		'END:VTIMEZONE'
	];

	for (const event of events) {
		if (!event.id || !event.title || !event.start || !event.end) {
			console.warn(`Skipping event with missing fields:`, event.id);
			continue;
		}

		const startFormatted = formatDateTime(event.start);
		const endFormatted = formatDateTime(event.end);

		if (!startFormatted || !endFormatted) {
			console.warn(
				`Skipping event ${event.id} with invalid date format - start: "${event.start}", end: "${event.end}"`
			);
			continue;
		}

		const startDate = new Date(event.start);
		const endDate = new Date(event.end);
		if (startDate >= endDate) {
			console.warn(`Skipping event ${event.id} with start >= end`);
			continue;
		}

		// EXDATE validation is bounded. Unlimited rules can still contain invalid ENDs
  // beyond this rolling horizon; subscriber acceptance remains unproven.
  const recurrence: string[] = [];
  const corrections: { scheduledDate: string; start: number; end: number }[] = [];
  if (event.recurrenceIntervalWeeks) {
   const spec = schedule(event);
   const horizon = Math.min(spec.recurrenceUntil ? Date.parse(spec.recurrenceUntil + 'T23:59:59Z') : Infinity, +rangeEnd);
   const master = expandOccurrences(spec, {from: Date.parse(spec.startDate) - 2 * 86400000, to: Date.parse(spec.startDate) + 369 * 86400000}).find(o => o.scheduledDate === spec.startDate);
   const masterDuration = master ? master.end - master.start : null;
   recurrence.push(`RRULE:FREQ=WEEKLY;INTERVAL=${event.recurrenceIntervalWeeks}${spec.recurrenceUntil ? ';UNTIL=' + formatICalTimestamp(berlinEndOfDay(spec.recurrenceUntil)) : ''}`);
   const step = event.recurrenceIntervalWeeks * 7 * 86400000;
   const anchor = Date.parse(spec.startDate);
   // Validate in bounded chunks, including historical slots in the master rule.
   for (let lower = anchor - 2 * 86400000; lower <= horizon; lower += 365 * 86400000) {
    const upper = Math.min(lower + 365 * 86400000, horizon + 2 * 86400000);
    const valid = new Set(expandOccurrences(spec, {from: lower - 2 * 86400000, to: upper + 2 * 86400000}).map(o => o.scheduledDate));
    for (let day = anchor + Math.max(0, Math.ceil((lower-anchor)/step))*step; day < upper && day <= horizon; day += step) {
     const date = new Date(day).toISOString().slice(0,10);
     if (!valid.has(date)) recurrence.push(`EXDATE;TZID=Europe/Berlin:${date.replaceAll('-', '')}T${spec.startTime.replace(':','')}00`);
    }
   }
   if (masterDuration !== null) {
    // An exception replaces any automatic correction for its slot.
    const exceptionDates = new Set((event.exceptions ?? []).map(exception => exception.scheduledDate));
    corrections.push(...expandOccurrences(spec, {from: +rangeStart, to: +rangeEnd})
     .filter(o => o.end - o.start !== masterDuration && !exceptionDates.has(o.scheduledDate)));
   }
  }
  const masterLineStart = lines.length;
  lines.push('BEGIN:VEVENT');
  lines.push(...recurrence);
		lines.push(`UID:${event.id}@cal72`);
		const stampDate = event.deletedAt || event.updatedAt || event.createdAt;
		lines.push(`DTSTAMP:${formatICalTimestamp(stampDate)}`);
		lines.push(`SEQUENCE:${event.sequence || 0}`);
		if (event.deletedAt) {
			lines.push(`LAST-MODIFIED:${formatICalTimestamp(new Date(event.deletedAt))}`);
			lines.push('STATUS:CANCELLED');
		} else if (event.updatedAt) {
			lines.push(`LAST-MODIFIED:${formatICalTimestamp(new Date(event.updatedAt))}`);
		}
		lines.push(`DTSTART;TZID=Europe/Berlin:${startFormatted}`);
		lines.push(`DTEND;TZID=Europe/Berlin:${endFormatted}`);
		lines.push(
			`SUMMARY:${escapeICalText(event.title)}${event.club ? ' [' + escapeICalText(event.club.name) + ']' : ''}`
		);
		lines.push(`DESCRIPTION:${escapeICalText(event.description)}`);
		lines.push('END:VEVENT');
  const masterLines = lines.slice(masterLineStart);
  if (event.recurrenceIntervalWeeks) lines.push(...exceptionInstances(event, rangeStart, rangeEnd));
  for (const occurrence of corrections) {
   // Same UID/sequence and original local start identify this recurrence instance.
   lines.push(...masterLines.filter(line => !line.startsWith('RRULE:') && !line.startsWith('EXDATE;') && !line.startsWith('DTSTART;') && !line.startsWith('DTEND;') && line !== 'END:VEVENT'));
   lines.push(`RECURRENCE-ID;TZID=Europe/Berlin:${occurrence.scheduledDate.replaceAll('-', '')}T${event.start.slice(11,16).replace(':','')}00`);
   lines.push(`DTSTART:${formatICalTimestamp(new Date(occurrence.start))}`);
   lines.push(`DTEND:${formatICalTimestamp(new Date(occurrence.end))}`);
   lines.push('END:VEVENT');
  }
	}

	lines.push('END:VCALENDAR');

	return lines.map(foldLine).join('\r\n') + '\r\n';
}
