# Bounded Berlin recurrence

`expandOccurrences(schedule, { from, to })` returns `{ id, scheduledDate, start, end }[]` with epoch-millisecond instants overlapping the half-open range. Inputs are `seriesId`, `startDate` (YYYY-MM-DD), `startTime`/`endTime` (HH:mm), `endDayOffset` (0–366 local calendar days), `recurrenceIntervalWeeks` (positive integer), and `recurrenceUntil` (inclusive YYYY-MM-DD or null). Null interval means recurrence disabled at persistence boundaries; this series-only API rejects it and does not handle one-offs.

Uses standard Intl with explicit Europe/Berlin and UTC calendar arithmetic, not process/browser timezone. No dependency needed. Supported schedule dates: 1900–9998. Bounds: at most 3660 requested days, 1001 candidate slots. Old anchors are reached arithmetically. Missing starts skip; ambiguous starts/ends select first instant. A nonexistent end skips only that occurrence, even when its start exists; neither time is shifted and other occurrences are retained. Local end offset preserves overnight wall-clock duration rather than elapsed seconds.

Identity is a JSON tuple of series ID and original scheduled local date/time, never query position or resolved UTC offset. Future exception consumers must retain this original slot when moving an occurrence; cross-schedule weekday remapping is not implemented.

Supporting checks: `node --test tests/recurrence-expansion.mjs`. These are utility tests only. The last public browser/database run passed 19/19 before subsequent interval and one-off corrections; those corrections have not received an integrated rerun. Later exception capabilities and Google/Apple acceptance remain pending.

## Individual occurrence changes (this occurrence only)

An organizer can edit or delete one occurrence of a series from its detail page ("Edit this occurrence", "Delete this occurrence"). This works for ended, in-progress and future occurrences. Other scopes (this and future, all upcoming) and series-level changes are not implemented; a bare series id stays read-only.

- **Storage:** one `event_exceptions` row per changed slot, unique on `(series_id, scheduled_date)`, where the date is the ORIGINAL scheduled date. Null columns inherit from the series; `club_overridden` separates an inherited club from an explicit "no club". `deleted` marks an individual deletion. `sequence` counts the slot's own revisions.
- **Overrides:** a field is stored only when the submitted value differs from what the series gives that slot, so all other fields keep inheriting later series updates. Saving every field back to its inherited value keeps the row (higher sequence) but it then publishes and hides nothing.
- **Identity:** unchanged by an exception. A moved occurrence keeps the id of the slot it replaces, so the original and the moved instance are never both listed.
- **Validation:** the slot must be one the series actually produces; the new start must precede the end; both must be existing Berlin local times (a spring-forward gap is rejected).
- **ICS:** the series stays one master `VEVENT`. Each changed slot adds an instance with the same UID and `RECURRENCE-ID` (original local start). A deleted slot is a `STATUS:CANCELLED` instance, not an `EXDATE`, so subscribers get cancellation metadata. Instance `SEQUENCE` is the series sequence plus the slot's sequence. An exception replaces any automatic DST end-time correction for its slot. Exception timestamps feed `Last-Modified`; the ETag covers the whole body.
- **Pending:** exceptions removed by schedule changes or series truncation (tickets 05 and 06), and Google/Apple acceptance (ticket 07). Cancelled-instance handling in real clients is unverified.

Checks: `node --test tests/recurrence-ics.mjs`, `bash tests/recurrence-migration.sh`, and `bash tests/run-public-tests.sh` (isolated PostgreSQL).
