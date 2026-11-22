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

for (const olderFails of [false, true]) test(`latest request owns diagnostics (older fails: ${olderFails})`, async () => {
 const source = readFileSync('src/routes/+page.svelte', 'utf8');
 const body = source.split('eventSources: [{ events: async (range: { start: Date; end: Date }) => {')[1].split('} }],')[0].replace('event: any', 'event');
 const pending = [];
 const factory = new Function('fetch', `let requestGeneration = 0; let occurrenceIssues = []; let loadError = ''; return { run: async (range) => {${body}}, state: () => ({ occurrenceIssues, loadError }) };`);
 const api = factory(() => new Promise(resolve => pending.push(resolve)));
 const range = { start: new Date('2026-01-01Z'), end: new Date('2026-02-01Z') };
 const a = api.run(range).catch(error => error);
 const b = api.run(range);
 const events = [{ id: 'B' }];
 pending[1]({ ok: true, json: async () => ({ issues: ['B'], events }) });
 assert.equal((await b)[0].id, 'B');
 pending[0]({ ok: !olderFails, json: async () => ({ issues: ['A'], events: [{ id: 'A' }] }) });
 const result = await a;
 if (olderFails) assert.ok(result instanceof Error);
 else assert.equal(result[0].id, 'A');
 assert.deepEqual(api.state(), { occurrenceIssues: ['B'], loadError: '' });
});
