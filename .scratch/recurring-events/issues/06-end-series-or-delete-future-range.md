# 06: End a series or delete its future range

**What to build:** Shorten a series end date or delete this and future occurrences while preserving earlier history and removing affected exceptions.

**Blocked by:** 02: Edit or delete one occurrence.

**Status:** ready-for-agent

## Acceptance criteria

- [ ] Allow shortening the optional inclusive end date and deleting This and future occurrences from a non-ended selection.
- [ ] Preserve earlier occurrences and ended history; ended selections offer individual deletion only.
- [ ] Remove exceptions belonging to removed series occurrences even when their displayed dates were individually moved outside the removed range.
- [ ] Preserve exceptions belonging to retained series occurrences.
- [ ] Retain inclusive occurrence-start-date semantics when shortening an end date, including overnight final occurrences.
- [ ] Reflect truncation and removal in subscribed ICS with valid update/cancellation behavior, stable identities and cache invalidation.
- [ ] Verify UI and parsed ICS results, retained history, moved-exception membership and no resurrected occurrences using isolated state.

## Context

Part of the Optional recurring events specification. Implement this ticket's behavior and applicable verification only; later capabilities remain governed by their blocking edges. Each implementation slice includes persistence, UI, ICS publication, tests and relevant documentation together.
