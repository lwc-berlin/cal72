# 02: Enforce verification on pull requests

**What to build:** Give reviewers automatic, visible verification results for pull requests by running the same command contributors use locally.

**Blocked by:** 01: Run reliable local verification.

**Status:** ready-for-agent

- [ ] Run ticket 01's canonical verification entry point in pull-request CI rather than maintaining a different set of checks.
- [ ] Install dependencies reproducibly using the project's locked package-manager setup and provide the synthetic environment required by verification.
- [ ] Use isolated disposable test resources without production credentials or access to existing application databases.
- [ ] Publish visible check outcomes and retain useful failure diagnostics; any required verification failure must fail the CI job.
- [ ] Observe and record a successful CI execution and demonstrate that a verification failure is surfaced as a failed check using isolated, controlled validation.
- [ ] Document the check names and any maintainer-only repository settings needed to require them before merge. Do not claim merge enforcement until those settings are verified.
- [ ] Do not change branch protection, repository permissions or secrets without separate explicit authorization; record any such setup as pending for the maintainer.
- [ ] Keep application behavior, recurrence semantics, production data and installed harness packages unchanged. Record pending or unavailable verification honestly.

## Context

Approved core follow-up from the recurring-events session retrospective. Enforce existing checks after ticket 01 makes the local verification path reliable. Optional action-test helper and tracking-cleanup proposals were not approved for ticket publication.
