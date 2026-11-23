# 04: Edit all upcoming occurrences

**What to build:** Update shared details across the active upcoming portion of a series without rewriting ended occurrences.

**Blocked by:** 03: Edit this and future occurrences.

**Status:** ready-for-agent

## Acceptance criteria

- [ ] Use the label All upcoming occurrences rather than Entire series.
- [ ] Include in-progress occurrences in bulk eligibility and protect ended occurrences.
- [ ] Demonstrate that All upcoming occurrences includes eligible occurrences before a selected later occurrence, unlike This and future occurrences.
- [ ] Preserve field-level exceptions and deletion exceptions while updating inherited fields.
- [ ] Keep ended occurrences individually editable/deletable, with bulk actions unavailable from ended selections.
- [ ] Verify boundary behavior, exception inheritance, preserved history and corresponding ICS updates through public interfaces.

## Context

Part of the Optional recurring events specification. Implement this ticket's behavior and applicable verification only; later capabilities remain governed by their blocking edges. Each implementation slice includes persistence, UI, ICS publication, tests and relevant documentation together.
