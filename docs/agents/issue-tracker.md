# Issue tracker: Local Markdown

Issues and specs live in this repository under `.scratch/`.

## Layout

- One feature per directory: `.scratch/<feature-slug>/`.
- Spec: `.scratch/<feature-slug>/spec.md`.
- Implementation tickets: one file per ticket at `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01` in dependency order.
- Record triage state as a `Status:` line near the top of each spec or ticket. Use the vocabulary in `triage-labels.md`.
- Record dependencies as `Blocked by:` references to local tickets. A ticket is startable only when all its blockers are complete.
- Append comments and decisions under `## Comments`.
- On completion, record verification evidence and set `Status: done`.

## Skill operations

- Publish: create the corresponding local Markdown file.
- Fetch: read the referenced spec or ticket file.
- List: inspect the feature directories and their status lines.
- Update: edit the local file, preserving its discussion and evidence.
- Publish implementation tickets only after the user approves the proposed breakdown.

## Hosting

Local Markdown temporarily replaces GitHub Issues because Issues are disabled in `lwc-berlin/cal72`. Do not publish issues elsewhere or change hosting settings without explicit user authorization.
