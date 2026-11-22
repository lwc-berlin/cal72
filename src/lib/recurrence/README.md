# Bounded Berlin recurrence

`expandOccurrences(schedule, { from, to })` returns `{ id, scheduledDate, start, end }[]` with epoch-millisecond instants overlapping the half-open range. Inputs are `seriesId`, `startDate` (YYYY-MM-DD), `startTime`/`endTime` (HH:mm), `endDayOffset` (0–366 local calendar days), `recurrenceIntervalWeeks` (positive integer), and `recurrenceUntil` (inclusive YYYY-MM-DD or null). Null interval means recurrence disabled at persistence boundaries; this series-only API rejects it and does not handle one-offs.

Uses standard Intl with explicit Europe/Berlin and UTC calendar arithmetic, not process/browser timezone. No dependency needed. Supported schedule dates: 1900–9998. Bounds: at most 3660 requested days, 1001 candidate slots. Old anchors are reached arithmetically. Missing starts skip; ambiguous starts/ends select first instant. A nonexistent end skips only that occurrence, even when its start exists; neither time is shifted and other occurrences are retained. Local end offset preserves overnight wall-clock duration rather than elapsed seconds.

Identity is a JSON tuple of series ID and original scheduled local date/time, never query position or resolved UTC offset. Future exception consumers must retain this original slot when moving an occurrence; cross-schedule weekday remapping is not implemented.

Supporting checks: `node --test tests/recurrence-expansion.mjs`. These are utility tests only. The last public browser/database run passed 19/19 before subsequent interval and one-off corrections; those corrections have not received an integrated rerun. Later exception capabilities and Google/Apple acceptance remain pending.
