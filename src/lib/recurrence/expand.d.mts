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
