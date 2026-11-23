# 07: Verify Google and Apple Calendar subscriptions

**What to build:** Establish actual subscribed-calendar compatibility in Google Calendar and Apple Calendar after the automated behavior is available.

**Blocked by:** 05: Change recurring schedules safely; 06: End a series or delete its future range.

**Status:** ready-for-agent

## Acceptance criteria

- [ ] Require passing automated public-interface and ICS standards checks before real-client acceptance.
- [ ] Subscribe through the existing ICS feed in both Google Calendar and Apple Calendar; use isolated test events.
- [ ] Verify weekly/every-N-weeks recurrence, optional/inclusive ending and Berlin local-time behavior.
- [ ] Verify individual rescheduling, field changes and deletion without duplicates or restored occurrences.
- [ ] Verify This and future occurrences and All upcoming occurrences updates, exception preservation and series truncation.
- [ ] Record client/platform, scenarios, observed refresh delays and actual results separately for each client; immediate refresh is not promised.
- [ ] Keep acceptance pending if either client or required access is unavailable; do not substitute parser success for client evidence.
- [ ] Do not introduce direct provider synchronization, OAuth or Outlook-specific verification.

## Context

Part of the Optional recurring events specification. Implement this ticket's behavior and applicable verification only; later capabilities remain governed by their blocking edges. Each implementation slice includes persistence, UI, ICS publication, tests and relevant documentation together.
