/** Berlin wall-clock weekly schedule consumed by the runtime expander. */
export interface RecurrenceSchedule {
	seriesId: string;
	startDate: string;
	startTime: string;
	endTime: string;
	endDayOffset: number;
	recurrenceIntervalWeeks: number;
	recurrenceUntil: string | null;
}

/** Half-open query range and occurrence instants are epoch milliseconds. */
export function expandOccurrences(
	schedule: RecurrenceSchedule,
	range: { from: number; to: number }
): { id: string; scheduledDate: string; start: number; end: number }[];

/** Berlin local `YYYY-MM-DDTHH:mm` to epoch milliseconds; undefined for a nonexistent local time. */
export function localToInstant(value: string): number | undefined;

/** Local start and end text of the occurrence scheduled on `scheduledDate`, before exceptions. */
export function scheduledLocal(
	schedule: RecurrenceSchedule,
	scheduledDate: string
): { start: string; end: string };

/** True when `scheduledDate` is an occurrence slot the series produces (not skipped or out of range). */
export function hasScheduledSlot(schedule: RecurrenceSchedule, scheduledDate: string): boolean;
