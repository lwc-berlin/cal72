# 05: Change recurring schedules safely

**What to build:** Change a series weekday or repeating interval within the supported bulk scopes without silently losing or duplicating exceptions.

**Blocked by:** 04: Edit all upcoming occurrences.

**Status:** ready-for-agent

## Acceptance criteria

- [ ] Support weekday and every-N-weeks interval changes under This and future occurrences and All upcoming occurrences.
- [ ] Map weekday changes to corresponding calendar-week slots; deleted slots stay deleted.
- [ ] Moved exceptions retain their explicit date/time and replace the corresponding new scheduled occurrence without duplication.
- [ ] Preserve overridden fields while inheriting applicable shared changes.
- [ ] Show edited exceptions removed by interval changes and require explicit confirmation before saving; cancelling leaves the existing schedule and exceptions unchanged.
- [ ] Do not silently reassign removed exceptions; confirmed removal follows the approved schedule.
- [ ] Preserve ended history and earlier occurrences outside the selected scope.
- [ ] Verify weekday slot mapping, deletion preservation, interval confirmation/cancellation, Berlin time behavior and ICS identity/update semantics through public interfaces.

## Context

Part of the Optional recurring events specification. Implement this ticket's behavior and applicable verification only; later capabilities remain governed by their blocking edges. Each implementation slice includes persistence, UI, ICS publication, tests and relevant documentation together.
