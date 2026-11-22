import { test } from 'node:test';
import assert from 'node:assert/strict';
import { expandOccurrences } from '../src/lib/recurrence/expand.mjs';
const base = { seriesId: 's', startDate: '2026-03-22', startTime: '02:30', endTime: '04:00', endDayOffset: 0, recurrenceIntervalWeeks: 1, recurrenceUntil: null };
const range = { from: Date.parse('2026-03-01Z'), to: Date.parse('2026-04-10Z') };
test('skips spring gap and retains scheduled slot identity', () => {
 const rows = expandOccurrences(base, range);
 assert.deepEqual(rows.map(x => x.scheduledDate), ['2026-03-22','2026-04-05']);
 assert.equal(rows[1].start, Date.parse('2026-04-05T00:30Z'));
 assert.equal(rows[1].id, JSON.stringify(['s','2026-04-05T02:30']));
});
test('first autumn instant and inclusive overnight end', () => {
 const [row] = expandOccurrences({...base, startDate:'2026-10-25', recurrenceUntil:'2026-10-25', endTime:'01:00', endDayOffset:1}, {from:Date.parse('2026-10-24Z'),to:Date.parse('2026-11-01Z')});
 assert.equal(row.start, Date.parse('2026-10-25T00:30Z'));
 assert.equal(row.end, Date.parse('2026-10-26T00:00Z'));
});
test('jumps from old anchor, every N weeks, half-open overlap', () => {
 const rows = expandOccurrences({...base,startDate:'2000-01-02',startTime:'19:00',endTime:'20:00',recurrenceIntervalWeeks:2},range);
 assert.ok(rows.length > 0);
 assert.ok(rows.every(x => x.end > range.from && x.start < range.to));
 assert.equal(rows[1].start-rows[0].start,14*86400000);
 assert.equal(rows[2].start-rows[1].start,14*86400000-3600000);
});
test('rejects invalid and excessively large requests', () => {
 for(const change of [{recurrenceIntervalWeeks:0},{startDate:'2026-02-30'},{endDayOffset:-1}]) assert.throws(()=>expandOccurrences({...base,...change},range));
 assert.throws(()=>expandOccurrences(base,{from:0,to:Infinity}));
 assert.throws(()=>expandOccurrences(base,{from:0,to:86400000*4000}));
});

test('skips missing Berlin end without shifting or losing surrounding weeks', () => {
 const rows = expandOccurrences({...base, startTime:'01:30', endTime:'02:30'}, range);
 assert.deepEqual(rows, [
  {id:JSON.stringify(['s','2026-03-22T01:30']), scheduledDate:'2026-03-22', start:Date.parse('2026-03-22T00:30Z'), end:Date.parse('2026-03-22T01:30Z')},
  {id:JSON.stringify(['s','2026-04-05T01:30']), scheduledDate:'2026-04-05', start:Date.parse('2026-04-04T23:30Z'), end:Date.parse('2026-04-05T00:30Z')}
 ]);
});
