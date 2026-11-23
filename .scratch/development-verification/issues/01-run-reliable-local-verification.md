# 01: Run reliable local verification

**What to build:** Give contributors one documented command that runs the existing verification checks reliably using synthetic configuration, with actionable prerequisite failures and trustworthy results.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Provide one documented verification entry point covering existing typechecking, linting, deterministic tests, isolated public-interface tests and synthetic migration safety checks.
- [ ] Repair the existing lint baseline without disabling rules, excluding failing coverage or silently omitting checks; preserve application behavior.
- [ ] Detect required executables, dependencies, Docker availability, conflicting test resources and synthetic configuration before starting services; explain missing prerequisites and return a nonzero exit code.
- [ ] Use disposable synthetic data and explicit synthetic configuration only; do not read production credentials or access existing application databases.
- [ ] Clean up resources created by the command on success, failure and interruption without touching unrelated resources.
- [ ] Preserve individual check outcomes, stdout/stderr and failure exit status; never report an overall pass when a required check failed or did not run.
- [ ] Verify the entry point's successful path and representative prerequisite, check-failure and cleanup paths through its public invocation.
- [ ] Document setup, invocation, expected results and any remaining warnings. Keep calendar behavior, recurrence semantics, production data and installed harness packages unchanged.

## Context

Approved core follow-up from the recurring-events session retrospective. Existing checks need a reliable shared entry point, not replacement checkers or additional agent instructions. Implementation and publishing application changes are not part of ticket creation.
