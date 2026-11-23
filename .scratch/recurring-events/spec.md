# Optional recurring events

Status: ready-for-agent

## Problem Statement

Club event organizers currently create and maintain each event separately. They need optional recurring events in the web UI, with matching recurrence and subsequent changes in subscribed calendars, without losing historical events or accidentally restoring deleted occurrences.

## Solution

Allow an event to repeat every N weeks on its scheduled weekday. Prompt for an inclusive end date but allow the series to have no end date. Display individual occurrences in the web UI and publish recurrence through the existing ICS subscription feed.

Offer three edit scopes: **This occurrence**, **This and future occurrences**, and **All upcoming occurrences**. Offer individual deletion and deletion of this and future occurrences. Preserve ended occurrences during bulk changes while allowing deliberate individual corrections or deletions. Preserve individual exceptions unless the user explicitly removes their part of the series.

## User Stories

1. As an organizer, I want recurrence to be optional, so that ordinary one-off events remain easy to create.
2. As an organizer, I want an event to repeat every week, so that I can schedule regular club activities once.
3. As an organizer, I want an event to repeat every N weeks, so that fortnightly and other multi-week schedules are supported.
4. As an organizer, I want the schedule to follow the event's weekday, so that occurrences appear on the intended day.
5. As an organizer, I want to be prompted for an end date, so that I can deliberately bound a series.
6. As an organizer, I want to leave the end date empty, so that ongoing activities do not need an artificial ending.
7. As an organizer, I want the end date to include occurrences starting on that date, so that the final day behaves predictably even for overnight events.
8. As a visitor, I want individual occurrences to appear in calendar and event listings, so that I can see upcoming activities rather than only the first event in a series.
9. As an organizer, I want to edit one occurrence, so that a special case does not change other dates.
10. As an organizer, I want to edit this and future occurrences, so that a schedule change can begin at a selected point.
11. As an organizer, I want to edit all upcoming occurrences, so that I can update the active schedule without rewriting ended events.
12. As an organizer, I want an in-progress occurrence to remain eligible for bulk editing, so that the history boundary is based on its end rather than its start.
13. As an organizer, I want ended occurrences protected from bulk edits, so that recorded history remains unchanged.
14. As an organizer, I want to edit a past occurrence individually, so that I can make intentional historical corrections.
15. As an organizer, I want to delete one past or future occurrence, so that I can remove it without deleting the rest of the series.
16. As an organizer, I want to delete this and future occurrences, so that I can stop an activity at a selected point while preserving earlier occurrences.
17. As an organizer, I want past occurrences to expose only individual edit/delete actions, so that I do not accidentally use them to trigger bulk changes.
18. As an organizer, I want individually overridden fields preserved during series edits, so that custom occurrence details are not lost.
19. As an organizer, I want non-overridden fields to continue inheriting series updates, so that changing a shared title also updates an occurrence with only a custom time.
20. As an organizer, I want individually deleted occurrences to remain deleted after ordinary series edits, so that updates do not restore cancelled activities.
21. As an organizer, I want a moved occurrence to retain its explicit date and time after the weekday changes, so that an intentional exception does not move unexpectedly.
22. As an organizer, I want weekday changes to preserve corresponding calendar-week slots, so that a moved exception replaces its corresponding occurrence and a deleted slot stays deleted.
23. As an organizer, I want to review and explicitly confirm edited exceptions removed by an interval change, so that they are not silently discarded or reassigned.
24. As an organizer, I want shortening the end date or deleting a range to remove exceptions belonging to the removed occurrences, so that exceptional dates do not survive an explicitly ended range.
25. As an attendee, I want recurring events to keep the same Europe/Berlin local time across daylight-saving changes, so that a 19:00 activity stays at 19:00.
26. As an attendee, I want an occurrence at a nonexistent spring-forward local start time to be skipped, so that its advertised time is not silently changed.
27. As an attendee, I want an ambiguous autumn start time to occur once at the first instance of that local time, so that the activity is not duplicated.
28. As a calendar subscriber, I want the existing ICS feed to represent recurring series, so that I do not need a separate provider integration.
29. As a calendar subscriber, I want individual edits, deletions and future-series changes reflected on refresh, so that my calendar remains consistent with the web UI.
30. As a calendar subscriber, I want stable event identities and valid update/cancellation metadata, so that refreshes do not duplicate or resurrect occurrences.
31. As an existing user, I want one-off events and their subscriptions to retain their current behavior, so that recurrence does not break existing usage.

## Implementation Decisions

### Agreed behavior

- Canonical domain concepts are **series**, **occurrence**, and **exception**. An exception is an individual change or deletion, not a duplicated independent event.
- Initial recurrence scope is weekly/every-N-weeks, anchored to the scheduled weekday. Daily, monthly and custom multi-weekday patterns are not included.
- The end date is optional and inclusive by occurrence start date. An included occurrence may end the next day.
- Recurrence follows Europe/Berlin wall-clock time. Skip nonexistent local start times and select the first instance of an ambiguous local start time.
- Use **All upcoming occurrences**, not **Entire series**, because bulk edits preserve ended occurrences. In-progress occurrences remain eligible. This scope starts at the current active portion; **This and future occurrences** starts at the selected occurrence instead.
- Ended occurrences expose individual edit/delete actions only. Individual historical corrections and deletions are allowed.
- Individual exceptions preserve only overridden fields; unmodified fields inherit applicable series updates. Deletion exceptions remain deleted during ordinary series edits.
- A weekday change maps corresponding calendar-week slots. An individually moved occurrence keeps its explicit date/time and replaces the corresponding new scheduled occurrence rather than creating both. Deleted slots remain deleted.
- When an interval change removes edited exceptions, show the affected exceptions and require explicit confirmation before saving; do not silently remap them.
- Explicit series truncation or range deletion removes exceptions belonging to removed occurrences, including those moved to another date. Membership is based on the corresponding series occurrence, not merely the exception's displayed date.
- Existing ICS subscription delivery is sufficient. Provider-controlled refresh delays are expected; immediate synchronization is not promised.

### Technical direction and constraints

- Extend event persistence, server-side validation/actions, create/edit controls, occurrence-aware calendar/list/detail rendering, and ICS publication together. Preserve existing one-off records and behavior.
- Prefer a series schedule with occurrence exceptions rather than eagerly inserting an unbounded set of event rows. Exact schema, recurrence library and series-splitting representation are implementation choices, not user-approved contracts.
- Expand only bounded viewing/query ranges, even for series without an end date. A series must remain discoverable when its first occurrence precedes the requested range.
- Publish standards-compliant recurrence and exception semantics with stable series/occurrence identities, sequence updates and cancellation behavior. Preserve existing feed caching/update semantics without stale recurrence data.
- Ensure web rendering and ICS publication agree on occurrence identities, timezone rules, exception inheritance and series truncation. Do not rely on the browser/server process timezone for Berlin recurrence semantics.
- Treat migration safety and subscription identity compatibility as explicit implementation verification concerns.

## Testing Decisions

- Prefer the existing highest public boundaries: the web UI and the public ICS endpoint. Assert external behavior rather than database layout, private recurrence helper structure or library internals.
- The proposed testing boundaries were presented during planning: create/display/edit/delete through the web UI, recurrence/update/cancellation through the ICS endpoint, and one-off compatibility. Invocation of this synthesis does not constitute observed test evidence.
- Exercise creation, calendar/list/detail visibility and each supported edit/delete scope end to end with isolated test data.
- Verify every-N-weeks schedules, inclusive/absent end dates, overnight final occurrences, and series whose first occurrence is outside the visible/feed range.
- Verify ended versus in-progress boundaries, individual historical corrections/deletions, and preservation of earlier occurrences during future changes.
- Verify field-level inheritance, preserved deletion exceptions, moved exceptions without duplicates, weekday slot mapping, interval-change confirmation, and removal of exceptions belonging to truncated/deleted ranges.
- Verify Berlin recurrence across spring and autumn changes, skipped nonexistent start times and first-instance ambiguous start times.
- Verify public feed semantics with a standards-aware parser: recurrence, exceptions, stable identities, updates/cancellations, cache invalidation and consistency with the web UI. Output snapshots alone are insufficient.
- Prove existing one-off creation, editing, deletion, listing and feed behavior still hold.
- No test script or established automated test suite was identified during exploration. Establish an appropriate runnable harness; do not claim existing test prior art that has not been found.
- Automated ICS standards checks are the initial verification gate. Subsequently perform real subscription acceptance checks in **Google Calendar** and **Apple Calendar**, covering recurrence, individual edits/deletions and future-series changes. Mark these checks pending until actually performed; automated parsing is not proof of client compatibility.

## Out of Scope

- Direct Google Calendar, Outlook or other provider write/synchronization integrations, credentials and OAuth.
- Daily/monthly/yearly recurrence and arbitrary multi-weekday schedules.
- Bulk rewriting or deleting ended occurrences; deliberate individual edits/deletions remain supported.
- Restoring individual deletions as an automatic side effect of ordinary series changes.
- Automatically retaining removed exceptions as standalone events.
- User-selectable per-series timezones.
- Outlook-specific acceptance verification.
- Publishing implementation tickets, implementing the feature, deployment or release as part of this specification step.

## Further Notes

- This specification synthesizes the confirmed requirements interview. It does not claim application changes, tests, migrations or calendar-client verification have been performed.
- Existing calendar delivery is an ICS subscription, not a push integration. External calendars control refresh timing.
- Current date handling mixes local text, UTC comparisons and runtime-local formatting; recurrence implementation must address affected paths without silently changing unrelated one-off behavior.
- The next planning step is a proposed set of end-to-end implementation tickets with explicit blocking edges, reviewed for granularity before publication.
