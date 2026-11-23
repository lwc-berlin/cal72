# CAL72

CAL72 manages club events and their calendar subscriptions.

## Language

**Series**:
A repeating event with a shared schedule and event details.
_Avoid_: Recurring entry, repeated copies

**Occurrence**:
One scheduled instance of a series, including an instance individually rescheduled to a different date or time.
_Avoid_: Copy, recurrence entry

**Exception**:
An individual occurrence that has been changed or deleted independently of its series.

**All upcoming occurrences**:
The scope of a series edit that affects upcoming occurrences while preserving past occurrences and individual exceptions.
_Avoid_: Entire series

**This and future occurrences**:
The scope of a change beginning with a selected occurrence and extending to later occurrences in its series.
