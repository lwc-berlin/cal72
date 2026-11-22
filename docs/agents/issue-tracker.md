# Issue tracker: GitHub

Issues and specs live in `lwc-berlin/cal72`. Use the gh CLI.

Always pass --repo lwc-berlin/cal72 to gh issue and label commands:
this clone currently defaults to upstream. Use repos/lwc-berlin/cal72
for API paths.

- Publish a spec or ticket: gh issue create.
- Fetch a ticket: gh issue view <number> --json number,title,body,labels,comments.
- List work: gh issue list --state open, with appropriate label filters.
- Comment: gh issue comment <number> --body "...".
- Update labels: gh issue edit <number> --add-label / --remove-label.
- Close: post an explanation with gh issue comment, then gh issue close.
  Post comments separately even if the issue is already closed.
- Link child issues with native sub-issues where supported; otherwise put
  "Part of #<parent>" in the child and a task-list link in the parent.
- Record blockers with native issue dependencies where supported;
  otherwise put "Blocked by: #<number>" at the top of the child.
  Work is startable only when every blocker is closed.
- For wayfinding, use a map issue labelled wayfinder:map and linked child
  tickets labelled wayfinder:<type>. Claim with --add-assignee @me;
  resolve with an explanation, closure, and a map decision pointer.
  Create missing wayfinder labels when that workflow is used.

## Pull requests as a triage surface

**PRs as a request surface: no.**

Never publish issues to upstream or a skills repository without explicit authorization.
