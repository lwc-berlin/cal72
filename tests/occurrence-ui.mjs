import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { compile } from 'svelte/compiler';

for (const path of ['src/routes/+page.svelte', 'src/routes/events/+page.svelte']) {
 test(`${path}: accessible diagnostics and bounded-range disclosure compile`, () => {
  const source = readFileSync(path, 'utf8');
  assert.match(source, /\{#if (?:data\.)?occurrenceIssues\.length > 0\}/);
  assert.match(source, /role="status" aria-label="Recurring event display issues"/);
  assert.match(source, /\{#each (?:data\.)?occurrenceIssues as issue\}/);
  assert.match(source, /Series \{issue\.seriesId\}: \{issue\.message\}/);
  if (path.includes("events/")) assert.match(source, /366 days before and after page load/);

  assert.ok(compile(source, { filename: path, generate: 'server' }).js.code);
 });
}
test('calendar encodes composite IDs and discloses navigation limitation', () => {
 const source = readFileSync('src/routes/+page.svelte', 'utf8');
 assert.ok(source.includes('goto(`/events/${encodeURIComponent(String(info.event.id))}`)'));
 assert.match(source, /eventSources:/);
 assert.match(source, /range.start.toISOString/);
});
