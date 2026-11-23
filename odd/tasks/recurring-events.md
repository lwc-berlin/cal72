# Recurring events implementation
Branch: feat/recurring-events; delivery: ask-on-risk; runner: to establish.
Objective: implement .scratch/recurring-events/spec.md through its dependency graph.

## Specs
S1 — Authoritative specification (verbatim; amended by S2):
S2 — Nonexistent occurrence end: user selected “Skip that occurrence (recommended)”: “Do not shift either time. Keep all other occurrences in the series available.”

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

S3 — User selected “Keep open-ended series with a rolling correction window”: “Publish explicit exclusions and time corrections over a documented future window, refreshed with the subscription. Beyond that window, exact end-time behavior is not guaranteed.”

## Current ticket-01 outcome
T1 completed at `668af2f` (runtime corrections) and `6ffd80b` (calendar declaration); later tickets remain pending. Public 19/19, focused 21/21, independent 6-assertion timezone/interval proof, synthetic populated migration PASS, raw-query baseline differential 10/10 (mocked predicates). Frozen install, typecheck and synthetic-URL production build pass. Existing accessibility and circular-dependency warnings remain. Committed-range native assessments succeeded: review not due (under_budget); no approval claimed. Google/Apple acceptance remains T7. No production migration/deploy/push. Earlier T1 snapshots below are historical, superseded by this block and ticket verification evidence. Review boundary: 6ffd80b; publication remains human-controlled.

Retrospective recommendations (not implemented): wire existing checks into CI after repairing lint baseline; budget-aware read-only harness preflight; reusable HTML/JSON action contract helper; compact current status separate from history.

## Tasks
- T1 | S1 | ticket `.scratch/recurring-events/issues/01-create-and-display-recurring-series.md` | route: isolated implementer + merger | in_progress (resumed as bounded implementation slices) | commit: pending; worker mwrypudy-5-dcaj in ticket-01 worktree; persistence slice 00eb8e8: writer migration RED/GREEN; native review review-f62da46dd79717c3 approved and acknowledged, authority burned; advisory R3-001 readiness socket race. Independent verifier structural only, runtime UNMET (helper rejects worktrees, 0 tests); unavailable check not retried. Sync exited 0. Creation controls: direct Playwright invocation timed out 60s without synthetic DB (runner bypassed), 0 assertions, no edits. Timed-out check not retried. Worker mwryxzx4-8-iat5 implementing controls/tests with runtime proof explicitly missing; correct setup pointer tests/run-public-tests.sh. Creation slice committed 167ad7f, runtime proof missing (prior timeout not retried); typecheck still fails existing calendar declarations, diff check passed. Native assessment under_budget, pending boundary 00eb8e8; independent creation inspection mwrz0p72-a-p8j6 structurally consistent, 0 tests, runtime proof unmet; test assertion correction 3954150 committed (exact errors/action 400/public-list absence; creation visible effects); diff check passed, assertions UNEXECUTED, runtime proof missing. Expansion 347f10a committed: RED then 4/4 GREEN in default and America/New_York TZ; finite <=3660-day ranges, known nonexistent-end gap. Native accumulated assessment remains under_budget at 212 lines (base 00eb8e8). Web query wiring mwrz3gn6-c-wsrw found necessary detail/edit/UI boundaries, no edits; scope expanded to those precise event routes and resumed worker mwrz4w2p-d-sc30. Keep raw ICS separate and guard all unsupported recurring mutations. Web queries 91078c0 and page/detail/guard wiring fb8f161 committed; helper tests 4/4, diff checks pass, routing/type/calendar/public proof missing. Human selected skip occurrence for nonexistent END; missing-END correction 2db9ceb RED then 5/5 GREEN in UTC/New_York, diff check passed. ICS worker mwrzbmsz-h-ov77 resumed with dedicated raw-series query scope approved. Independent committed routing/guard verification mwrzbsu1-i-4o9r active; accumulated assessment 380 lines under_budget at base 00eb8e8. Independent routing inspection found one-off +/-366-day listing regression and invisible occurrence issues (static, not reproduced); fixes assigned to active events.ts owner mwrzbmsz-h-ov77 and disjoint UI worker mwrzds26-j-0jwv. ICS/query fix 76a4360: 4/4 supporting parser/mock tests in two timezones, one-off byte differential pass; endpoint/cache proof missing. UI fix 7b6702c: diagnostics and encoded links, 3/3 static checks; +/-366-day calendar notice fallback, dynamic navigation still limited. Typecheck 8 errors under diagnosis mwrzfnj4-k-jwd0; independent ICS/UI verification mwrzfy10-l-bbf6 active. Accumulated assessment 481 lines under_budget. Independent ICS/UI check: 6 pass/1 unavailable (git-history test in archive); found artificial unbounded UNTIL/cache risk, corrective worker mwrzhpml-m-24e7 active including self-contained tests. Type fix 4b38a02 reduces 8 errors to 1 preexisting calendar declaration; warning remains. Calendar visible-range fetching worker mwrzi2mq-n-hrtj active. ICS correction 5cc4df1 committed: 7/7 mocked GET tests default/New_York; unlimited RRULE and recurrence timestamp304 corrected; self-contained fixture. Remaining S2 end-gap exclusions only rolling365days; standards investigation mwrzkf6u-o-hiux active, not accepted as complete. Accumulated assess700lines remains under_budget. Calendar range34800e8:14 deterministic checks pass; typecheck1existing error. Human authorized one correctly prepared integrated run job2:exit1,9pass4fail, authority exhausted/no retry; failure correction worker mwrzvbkw-p-siwr. Human accepted rolling ICS correction window; duration/EXDATE/doc worker mwrzvlzw-q-x8mc. Integrated failure correction2da8364: hydration readiness before form fills; observed Missing field/cleared fields, no historical-date restriction. Compilation/diff checks pass; hydration hypothesis browser-unconfirmed, no rerun. Calendar independent verification mwrzxk40-r-j65t active. ICS rolling override d57dc83:9/9 mocked GET/parser tests twoTZ, documented365day window. Human authorized second one-shot run job3:exit2 before tests, reproduced PostgreSQL temporary-server readiness race; no retry, helper fix worker mws0be15-s-18nq. Calendar verifier runtime unavailable (unsupported worktree helper), static potential stale-diagnostics race; bounded fix/probe worker mws0bl2l-t-8p2t. Harness fix0ce27eb: explicitTCP readiness/psql, bounded30 probes, mocked RED/GREEN and syntax/diff checks pass; real runner not repeated. Current deterministic suite job4 running; calendar race worker active. Deterministic suite job4:29/29pass. Calendar race32f30e6:15/15 supporting tests. Native review review-082355bdfb993239 correction_required R3-001 false chunk EXDATE and R3-002 wall/UTC one-off filtering; accepted180diff-line correction plan, frozen200 logical budget, one cycle worker mws0q4gf-v-98tk. STATUS corrected_candidate_unavailable: commit bounded correction then resume same lineage. Bounded correction9ad0252:35diff lines, RED9pass2fail/GREEN11pass; native lineage082355bdfb993239 validator approved+acknowledged authority burned, boundary9ad0252. AdvisoriesR1-001/R4-001 interval limit mismatch remain separate follow-up, not native blockers. Independent concurrency structural sound, runtime unavailable mandatory isolator rejects worktrees. Human authorized third single integrated run; job5 exited1:10pass3fail; creation accepted then series absent by exact-link assertion, hydration issue no longer failure. No retry. Distinct listing diagnosis/fix worker mws0vrbf-w-btcj active using logs/context and deterministic probes only. Listing assertion correction cffe84f: logs show52links for unbounded series and bounded past disclosure; tests now target unique scheduled anchor/count/identity, isolated probe/diff check passed, browser-unverified. Assess base9ad0252:18lines medium under_budget. Human authorized fourth single integrated run; job6 exited1:10pass3fail; creation/list anchors now pass, failure advanced to occurrence detail heading after navigation. No retry; new distinct detail boundary diagnosis mws18lwp-x-uscf active, no e2e expectation weakening. Exact job6 inspection disproves production detail failure: strict-locator collisions73/2headings and75times; snapshot correct detailh1/time. No production edits. Narrow test URL/navigation/detail semantics correction mws1a6mx-y-jmo9 active; browser-unverified, no DB/rerun. Test navigation correction0a8167b committed:exactURL,level1heading,detailmainUTCtime; syntax/diff pass, browser-unverified. No active workers. Human authorized fifth single isolated run; job7 PASSED13/13 exit0, disposable synthetic DB cleaned by runner, no automatic retry. Full acceptance coverage audit/test additions worker mws1ums9-z-sx1f active; no fullT1 claim yet; last runtime10pass3fail remains. Acceptance test5a37347 adds parsed recurrence/UID/end and one-off edit/delete lifecycle, UNEXECUTED, diffcheckpass. Remaining DST/oldanchor/cache/guard public tests worker mws1x9f1-10-ys34 active. Latest observed browser result remains13/13pass before additions. Public acceptance5c75d09 adds oldanchor finite endpoint,DST start/end/ambiguity,guard exact rejection/nonmutation,conditionalICS; UNEXECUTED,diffcheckpass. Remaining actual widget navigation,current-horizon parsedDST/cache-after-change/invalidranges,migration independent proof and calendarclient acceptance. Human authorized expanded public suite once; job8 exited1:15pass4fail (oldanchor guard,oneoff lifecycle,bounded iterator termination expectednull receivedundefined). No retry. Exact failure diagnosis/correction worker mws376nj-11-8444 active,test-only scope; product defects require separate scoped handoff. Test correctionda4e886:formencodedPOST reaches guard instead415; oneoff deleted feed retainsCANCELLED/stableUID/sequence; iterator exhaustionundefined+complete. Two isolatedprobes pass,integrated-unverified. Before rerun baseline deleted-detail404 assumption investigated by mws39hq1-12-x4ml; no productionfix authorized for inventedcontract. Baseline check23fa5d1 test-only:deleted oneoff detail baseline/current remains200withtitle (softdeleted lookup), invented404 replaced; listingabsence/CANCELLED/UID/sequence retained,diffcheckpass. Await authorization for corrected expanded suite, no activeworkers. Full ticket incomplete; tracer commit df91992; one-off public tracer PASS; recurrence RED (missing control); build PASS; check FAIL (calendar declarations); lint FAIL (13 existing/context files); production implementation pending
- T2 | S1 | ticket `.scratch/recurring-events/issues/02-edit-or-delete-one-occurrence.md` | route: inline (one behavior: persistence+UI+ICS; no Writer trigger; independent verifier at end — Risk item 1 persisted format change) | implemented + independently verified; native review pending consent | branch feat/recurring-events-02 stacked on feat/recurring-events (PR #1) | commits: 221469f (schema+migration), db3692d (behavior)
- T3 | S1 | ticket `.scratch/recurring-events/issues/03-edit-this-and-future-occurrences.md` | route: isolated implementer + merger | pending | commit: pending
- T4 | S1 | ticket `.scratch/recurring-events/issues/04-edit-all-upcoming-occurrences.md` | route: isolated implementer + merger | pending | commit: pending
- T5 | S1 | ticket `.scratch/recurring-events/issues/05-change-recurring-schedules-safely.md` | route: isolated implementer + merger | pending | commit: pending
- T6 | S1 | ticket `.scratch/recurring-events/issues/06-end-series-or-delete-future-range.md` | route: isolated implementer + merger | pending | commit: pending
- T7 | S1 | ticket `.scratch/recurring-events/issues/07-verify-google-and-apple-subscriptions.md` | route: isolated implementer + merger | pending | commit: pending

## Log
L3: Ticket 01 resumed and integrated by fast-forward onto feat/recurring-events at 668af2f. Final isolated public run: `bash tests/run-public-tests.sh` in ticket-01 worktree, exit 0, 19/19 passed (job-5); disposable synthetic PostgreSQL only. Review corrections: int32 interval support and independently resolved legacy one-off Berlin instants; deterministic RED/GREEN 21/21 and independent 6-assertion probe. Human chose pre-transition offset for nonexistent legacy one-off wall times, first instance for ambiguous times, without rewriting stored values. Standards review: no hard breach; spec review defects corrected. Typecheck failed with missing @event-calendar/core declarations (1 error,1 warning); build failed DATABASE_URL unset. Native review assessment unavailable due untracked declaration error, no approval claimed. Migration safety independent runtime proof, differential shared-query check, and calendar-client acceptance remain pending. Ticket is not marked done. Prior task-line runtime snapshots are historical. No publishing or production migration performed. Commit slice boundary 668af2f includes prior ticket work-unit history; publication shape remains undecided.
L1: User invoked implement-spec with `.scratch/recurring-events/spec.md`; follow the supplied implement-spec workflow.
L2: Integration branch created at bf69075. Existing human edits preserved. Graph: 01 → 02 → 03 → 04 → 05; 02 → 06; 05+06 → 07. Real calendar acceptance pending access. Forecast exceeds 400 authored lines; local ticket work units, no publishing authorized.
L4: User asked to orchestrate #2 (ticket 02) under the system guardrails. Branch feat/recurring-events-02 created from feat/recurring-events a815ff6. Design: new event_exceptions table (field-level nullable overrides + club_overridden flag + deleted flag + per-slot sequence); occurrence identity stays the original slot tuple; ICS emits RECURRENCE-ID overrides (moved/edited) and RECURRENCE-ID + STATUS:CANCELLED (deleted); series-level edit/delete by numeric id stays failing closed (tickets 03-06).
L5: T2 verification: node 42/42, migration script PASS, public suite 28/28, svelte-check 0 errors; independent verifier: 6/6 acceptance criteria PASS, no blockers, one-off feed/API byte-identical to baseline. Advisories: (1) a reverted exception emits no ICS instance, so Google/Apple may keep a cached override until refresh (ticket 07); (2) event_exceptions.club ON DELETE SET NULL turns an overridden club into no-club if the club is deleted; (3) no-op exception rows keep a series published (harmless). Lint baseline still red (4 pre-existing + 1 same-class new href). Google/Apple acceptance remains pending.
