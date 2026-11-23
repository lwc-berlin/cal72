# 02: Edit or delete one occurrence

**What to build:** Individually edit, reschedule or delete one occurrence, including a past occurrence, without changing other occurrences.

**Blocked by:** 01: Create and display recurring series.

**Status:** ready-for-agent

## Acceptance criteria

- [ ] Expose this-occurrence editing and deletion for future, in-progress and ended occurrences.
- [ ] Store individual changes as field-level exceptions; retain the distinction between overridden and inherited fields for subsequent series updates.
- [ ] Rescheduling replaces the original occurrence without leaving both original and moved instances visible.
- [ ] Individual deletion leaves other occurrences intact, including for past deletions.
- [ ] Reflect changes and deletions in standards-compliant ICS with stable occurrence identities, update/cancellation metadata and refreshed caching.
- [ ] Verify UI and parsed public ICS behavior with isolated data, asserting unaffected occurrences and unchanged one-off behavior.

## Context

Part of the Optional recurring events specification. Implement this ticket's behavior and applicable verification only; later capabilities remain governed by their blocking edges. Each implementation slice includes persistence, UI, ICS publication, tests and relevant documentation together.
