# Recurring calendar subscriptions

Weekly/every-N-weeks series follow Europe/Berlin wall-clock scheduling. An optional end date includes starts on that date, including overnight events. Without an end date, the ICS RRULE remains unlimited. One-off publication is unchanged.

Each subscription refresh publishes explicit EXDATE exclusions for nonexistent local starts or ends through 365 days from the request time. Valid occurrences whose elapsed duration differs from the master receive RECURRENCE-ID overrides with explicit start/end instants, retaining the series UID and sequence. Ambiguous local times use the first instance. Corrections cover the feed's rolling range (180 days past through 365 days future); exclusions also retain historical rule slots. Finite series are corrected only through the same future horizon, without changing their inclusive RRULE end.

Beyond the future correction window, exact end-time behavior is not guaranteed. Refresh the subscription to advance the correction horizon. Calendar providers control refresh timing; immediate synchronization is not promised. Recurrence feeds revalidate by body ETag rather than relying on unchanged event timestamps.

## Verification status

Deterministic mocked public GET tests and ICS parser checks cover duration corrections, exclusions, identities, caching and unchanged one-offs. They do not prove database integration or real-client acceptance. Google Calendar and Apple Calendar acceptance remain pending. The last public browser/database run passed 19/19 before the subsequent interval and one-off corrections; those corrections have not received an integrated rerun. For one-off range filtering, stored Berlin wall times resolve to instants: ambiguous autumn times use the first instant, while spring-gap times use the pre-transition offset (02:30 becomes the instant for 03:30). Stored and displayed text is unchanged; recurring gap occurrences are still skipped.
