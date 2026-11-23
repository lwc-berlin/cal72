# 03: Edit this and future occurrences

**What to build:** Change shared event details beginning at a selected occurrence while keeping earlier occurrences unchanged.

**Blocked by:** 02: Edit or delete one occurrence.

**Status:** ready-for-agent

## Acceptance criteria

- [ ] Offer This and future occurrences on a selected non-ended occurrence; ended occurrences expose individual actions only.
- [ ] Change shared event details from the selected occurrence onward without changing earlier occurrences.
- [ ] Preserve individually overridden fields while non-overridden fields inherit applicable series changes; deleted exceptions stay deleted.
- [ ] Demonstrate a title update reaching an occurrence with only a custom time without changing that time.
- [ ] Publish corresponding ICS updates without duplicate or resurrected occurrences, preserving earlier identities and history.
- [ ] Verify scope boundaries, exception inheritance and cancellation preservation through UI and parsed ICS checks; leave schedule remapping to ticket 05.

## Context

Part of the Optional recurring events specification. Implement this ticket's behavior and applicable verification only; later capabilities remain governed by their blocking edges. Each implementation slice includes persistence, UI, ICS publication, tests and relevant documentation together.
