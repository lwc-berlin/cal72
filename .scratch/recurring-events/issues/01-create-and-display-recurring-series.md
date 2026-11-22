# 01: Create and display recurring series

**What to build:** Create an optionally repeating event and see its individual occurrences in the web UI and existing ICS subscription.

**Blocked by:** None (can start immediately).

**Status:** done

## Acceptance criteria

- [x] Recurrence remains off by default; every week and every N weeks follow the scheduled weekday.
- [x] Prompt for an inclusive end date and allow no end date; an included occurrence may end the following day.
- [x] Show occurrences in calendar, event listings and details using bounded ranges; discover series whose first occurrence precedes the requested range.
- [x] Keep Europe/Berlin wall-clock time across DST; skip nonexistent local start times and use the first instance of ambiguous start times.
- [x] Publish standards-compliant ICS recurrence with stable identities and appropriate feed caching.
- [x] Establish runnable isolated public-interface tests covering the creation UI and parsed ICS semantics, including open-ended, overnight, range and DST cases.
- [x] Preserve existing one-off creation, editing, deletion, listing and feed behavior; verify safe persistence changes against existing events.
- [x] Keep series-level mutation behavior for later tickets unavailable until implemented; do not accidentally route it through one-off actions.

## Verification

Implementation integrated on `feat/recurring-events` at `668af2f`; calendar declarations committed as `6ffd80b`.

- Isolated public UI/parsed-ICS suite: `bash tests/run-public-tests.sh`, exit 0, 19/19 passed on the corrected runtime candidate, before the declaration-only change. Disposable synthetic PostgreSQL; no production access.
- Focused recurrence/feed/query deterministic tests: 21/21 passed; independent gap/fold/interval probes: 6 assertions passed.
- `bash tests/recurrence-migration.sh`: exit 0; preserved populated legacy rows/defaults and checked atomic rejection of invalid recurrence updates in an isolated container.
- Independent baseline/candidate raw-query differential: 10/10 matched, including ordering, console/error outcomes; mocked predicates, not production SQL semantics.
- `pnpm install --frozen-lockfile` and `pnpm check`: exit 0; 0 type errors and 1 existing accessibility warning.
- `DATABASE_URL=postgres://synthetic:synthetic@127.0.0.1:1/synthetic pnpm build`: exit 0; existing accessibility and Drizzle circular-dependency warnings. No database connection attempt reported.
- Standards/spec review completed; accepted-interval and legacy one-off filtering findings corrected and independently inspected. Explicit committed-range native assessments succeeded; review not due (`under_budget`). No native approval claimed.
- Earlier failed runs are retained in task history; they are not passes. Real Google/Apple subscriber acceptance remains ticket 07, not established by automated parsing. No deployment or production migration performed.

## Context

Part of the Optional recurring events specification. Implement this ticket's behavior and applicable verification only; later capabilities remain governed by their blocking edges. Each implementation slice includes persistence, UI, ICS publication, tests and relevant documentation together.
