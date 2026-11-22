import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

async function handler(query) {
 const source = readFileSync('src/routes/api/occurrences/+server.ts', 'utf8');
 const calls = [];
 const js = ts.transpile(source.replace(/import .*?;\n/g, ''), { module: ts.ModuleKind.CommonJS });
 const exports = {};
 new Function('exports', 'getWebOccurrences', js)(exports, async (...args) => {
  calls.push(args);
  return { events: [{ id: 7, title: 'One-off', start: '2026-01-02', end: '2026-01-03' }], issues: [{ seriesId: 8, message: 'Invalid schedule' }] };
 });
 return { response: await exports.GET({ url: new URL('http://localhost/api/occurrences' + query) }), calls };
}
for (const query of ['', '?start=no&end=no', '?start=2026-02-30T00:00:00.000Z&end=2026-03-04T00:00:00.000Z', '?start=2026-01-01T00:00:00.000Z&end=2026-01-01T00:00:00.000Z', '?start=2026-01-01T00:00:00.000Z&end=2040-01-01T00:00:00.000Z']) {
 test('reject range ' + query, async () => {
  const { response, calls } = await handler(query);
  assert.equal(response.status, 400);
  assert.equal(typeof (await response.json()).error, 'string');
  assert.equal(calls.length, 0);
 });
}
test('public finite query preserves one-offs and diagnostics', async () => {
 const { response, calls } = await handler('?start=2026-01-01T00:00:00.000Z&end=2026-02-01T00:00:00.000Z');
 assert.equal(response.status, 200);
 const body = await response.json();
 assert.equal(body.events[0].id, 7);
 assert.equal(body.issues[0].seriesId, 8);
 assert.equal(calls[0][0].toISOString(), '2026-01-01T00:00:00.000Z');
 assert.equal(calls[0][1].toISOString(), '2026-02-01T00:00:00.000Z');
});
