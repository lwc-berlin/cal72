import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import assert from 'node:assert/strict';
import test from 'node:test';
import ts from 'typescript';
import ICAL from 'ical.js';
import { expandOccurrences } from '../src/lib/recurrence/expand.mjs';
const source = readFileSync('src/routes/calendar/+server.ts', 'utf8').replace(/^import .*;\n/gm, '');
const context = vm.createContext({ TextEncoder, console, expandOccurrences });
vm.runInContext(ts.transpile(source.replace('export const GET', 'const GET'), { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None }) + '\nglobalThis.serialize = generateICal;', context);
const fixture = { id: 42, title: 'Weekly', description: 'Test', start: '2026-03-15T19:00', end: '2026-03-15T20:00', createdAt: new Date('2026-01-01Z'), sequence: 3, recurrenceIntervalWeeks: 2, recurrenceUntil: '2026-04-12' };
const serialize = e => context.serialize(new Date('2026-01-01Z'), [e], new Date('2026-03-01Z'), new Date('2026-05-01Z'));
test('parsed master keeps UID, Berlin clock, interval and inclusive end', () => {
 const calendar = new ICAL.Component(ICAL.parse(serialize(fixture)));
 ICAL.TimezoneService.register(new ICAL.Timezone(calendar.getFirstSubcomponent('vtimezone')));
 const event = new ICAL.Event(calendar.getFirstSubcomponent('vevent'));
 assert.equal(event.uid, '42@cal72');
 assert.equal(event.sequence, 3);
 const iterator = event.iterator(); const dates = []; let date;
 while ((date = iterator.next())) dates.push(date.toString());
 assert.deepEqual(dates, ['2026-03-15T19:00:00','2026-03-29T19:00:00','2026-04-12T19:00:00']);
});
test('parsed inclusive cutoff excludes next Berlin day in summer and winter', () => {
 for (const [start, until, expected] of [
  ['2026-06-28', '2026-07-04', ['2026-06-28T01:00:00']],
  ['2026-06-28', '2026-07-05', ['2026-06-28T01:00:00', '2026-07-05T01:00:00']],
  ['2026-01-04', '2026-01-10', ['2026-01-04T01:00:00']],
  ['2026-01-04', '2026-01-11', ['2026-01-04T01:00:00', '2026-01-11T01:00:00']]
 ]) {
  const calendar = new ICAL.Component(ICAL.parse(serialize({...fixture, start:start+'T01:00', end:start+'T02:00', recurrenceIntervalWeeks:1, recurrenceUntil:until})));
  ICAL.TimezoneService.register(new ICAL.Timezone(calendar.getFirstSubcomponent('vtimezone')));
  const iterator = new ICAL.Event(calendar.getFirstSubcomponent('vevent')).iterator();
  const dates = []; let date;
  while ((date = iterator.next())) dates.push(date.toString());
  assert.deepEqual(dates, expected);
 }
});
test('nonexistent END is explicitly excluded', () => {
 const calendar = new ICAL.Component(ICAL.parse(serialize({ ...fixture, start:'2026-03-15T01:30', end:'2026-03-15T02:30' })));
 assert.equal(calendar.getFirstSubcomponent('vevent').getFirstPropertyValue('exdate').toString(), '2026-03-29T01:30:00');
});
test('one-off serializer is byte-identical to baseline', () => {
 const event = { ...fixture, recurrenceIntervalWeeks: null };
 assert.equal(serialize(event), readFileSync('tests/recurrence-ics.fixture', 'utf8'));
});
test('default listing preserves distant one-offs; explicit windows filter them', async () => {
 const text = readFileSync('src/lib/server/db/events.ts','utf8');
 const begin = text.indexOf('export const getWebOccurrences =');
 const end = text.indexOf('/** Resolve only', begin);
 const rows = [{...fixture, start:'2000-01-01T12:00',end:'2000-01-01T13:00',recurrenceIntervalWeeks:null}];
 const chain = {from(){return this;},leftJoin(){return this;},where(){return Promise.resolve(rows);}};
 const ctx = vm.createContext({db:{select:()=>chain},eventSelect:{},Events:{},Clubs:{},eq:()=>null,isNull:()=>null,expandOccurrences});
 vm.runInContext(ts.transpile(text.slice(begin,end).replace('export const','const'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None})+'\nglobalThis.list=getWebOccurrences;',ctx);
 assert.equal((await ctx.list()).events.length,1);
 assert.equal((await ctx.list(new Date('2026-01-01Z'),new Date('2026-02-01Z'))).events.length,0);
});
test('explicit web range retains long and spring-gap one-offs', async () => {
 const text = readFileSync('src/lib/server/db/events.ts','utf8');
 const begin = text.indexOf('export const getWebOccurrences =');
 const end = text.indexOf('/** Resolve only', begin);
 const rows = [
  {...fixture,id:1,start:'2025-01-01T12:00',end:'2027-01-01T12:00',recurrenceIntervalWeeks:null},
  {...fixture,id:2,start:'2026-03-29T02:30',end:'2026-03-29T04:00',recurrenceIntervalWeeks:null}
 ];
 const chain = {from(){return this;},leftJoin(){return this;},where(){return Promise.resolve(rows);}};
 const ctx = vm.createContext({db:{select:()=>chain},eventSelect:{},Events:{},Clubs:{},eq:()=>null,isNull:()=>null,expandOccurrences});
 vm.runInContext(ts.transpile(text.slice(begin,end).replace('export const','const'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None})+'\nglobalThis.list=getWebOccurrences;',ctx);
 const result = await ctx.list(new Date('2026-03-29T00:00Z'),new Date('2026-03-29T04:00Z'));
 assert.deepEqual(Array.from(result.events, row => row.id), [1,2]);
 assert.equal(result.issues.length,0);
});
async function listOneOff(row, from, to) {
 const text = readFileSync('src/lib/server/db/events.ts','utf8');
 const begin = text.indexOf('export const getWebOccurrences =');
 const end = text.indexOf('/** Resolve only', begin);
 const chain = {from(){return this;},leftJoin(){return this;},where(){return Promise.resolve([row]);}};
 const ctx = vm.createContext({db:{select:()=>chain},eventSelect:{},Events:{},Clubs:{},eq:()=>null,isNull:()=>null,expandOccurrences});
 vm.runInContext(ts.transpile(text.slice(begin,end).replace('export const','const'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None})+'\nglobalThis.list=getWebOccurrences;',ctx);
 return ctx.list(new Date(from),new Date(to));
}
test('one-off autumn fold uses first instant across reversed wall-clock range', async () => {
 const row = {...fixture,start:'2026-10-25T02:30',end:'2026-10-25T02:45',recurrenceIntervalWeeks:null};
 const result = await listOneOff(row,'2026-10-25T00:40Z','2026-10-25T01:10Z');
 assert.equal(result.events.length,1); assert.equal(result.events[0].start,row.start); assert.equal(result.issues.length,0);
 assert.equal((await listOneOff(row,'2026-10-25T01:10Z','2026-10-25T01:20Z')).events.length,0);
});
test('one-off spring gap uses pre-transition offset', async () => {
 const row = {...fixture,start:'2026-03-29T02:30',end:'2026-03-29T04:00',recurrenceIntervalWeeks:null};
 const result = await listOneOff(row,'2026-03-29T01:20Z','2026-03-29T01:40Z');
 assert.equal(result.events.length,1); assert.equal(result.events[0].start,row.start); assert.equal(result.issues.length,0);
 assert.equal((await listOneOff(row,'2026-03-29T01:05Z','2026-03-29T01:20Z')).events.length,0);
});
test('long one-off overlaps explicit range without recurrence duration limit', async () => {
 const row = {...fixture,start:'2025-01-01T12:00',end:'2027-01-01T12:00',recurrenceIntervalWeeks:null};
 const result = await listOneOff(row,'2026-03-29T01:20Z','2026-03-29T01:40Z');
 assert.equal(result.events.length,1); assert.equal(result.events[0].end,row.end); assert.equal(result.issues.length,0);
});
async function probe(now, rows, headers = {}) {
 class Clock extends Date { constructor(...args) { super(...(args.length ? args : [now])); } }
 const ctx = vm.createContext({ TextEncoder, console, expandOccurrences, Date: Clock, Response, crypto: webcrypto,
  getAllEvents: async () => rows.filter(e => !e.recurrenceIntervalWeeks), getFeedSeries: async () => rows.filter(e => e.recurrenceIntervalWeeks), pruneDeletedEvents: async () => {} });
 vm.runInContext(ts.transpile(source.replace('export const GET','const GET'), {target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None})+'\nglobalThis.handler=GET;',ctx);
 const response = await ctx.handler({request:new Request('https://example.test/calendar',{headers})});
 return {status:response.status, body:await response.text(), headers:Object.fromEntries(response.headers)};
}
test('public unlimited rule and conditional refresh track rolling gap exclusions', async () => {
 const row = {...fixture, recurrenceUntil:null, start:'2026-03-15T01:30',end:'2026-03-15T02:30'};
 const first = await probe('2026-01-01Z',[row]);
 assert.equal(first.status,200);
 assert.match(first.body,/RRULE:FREQ=WEEKLY;INTERVAL=2\r\n/);
 const later = await probe('2027-04-01Z',[row],{'if-modified-since':first.headers['last-modified']});
 assert.equal(later.status,200);
 assert.notEqual(later.body,first.body);
 assert.notEqual(later.headers.etag,first.headers.etag);
 assert.equal(later.headers['last-modified'],first.headers['last-modified']);
 assert.equal(later.headers['content-type'],'text/calendar; charset=utf-8');
 const cached = await probe('2027-04-01Z',[row],{'if-none-match':later.headers.etag});
 assert.deepEqual(cached,{status:304,body:'',headers:{etag:later.headers.etag,'last-modified':later.headers['last-modified']}});
});
test('public one-off fixture and timestamp caching stay unchanged', async () => {
 const row = {...fixture,recurrenceIntervalWeeks:null};
 const first = await probe('2026-01-01Z',[row]);
 assert.equal(first.status,200); assert.equal(first.body,readFileSync('tests/recurrence-ics.fixture','utf8'));
 const cached = await probe('2027-04-01Z',[row],{'if-modified-since':first.headers['last-modified']});
 assert.deepEqual(cached,{status:304,body:'',headers:{etag:first.headers.etag,'last-modified':first.headers['last-modified']}});
});

test('public timestamp-only refresh cannot conceal a changed rolling body', async () => {
 const row = {...fixture,recurrenceUntil:null,start:'2026-03-15T01:30',end:'2026-03-15T02:30'};
 const first = await probe('2026-01-01Z',[row]);
 const later = await probe('2027-04-01Z',[row],{'if-modified-since':first.headers['last-modified']});
 assert.equal(later.status,200);
 assert.match(first.body,/EXDATE;TZID=Europe\/Berlin:20260329T013000/);
 assert.match(later.body,/EXDATE;TZID=Europe\/Berlin:20280326T013000/);
});

test('public feed corrects elapsed duration at spring transition with stable identity', async () => {
 const row = {...fixture, recurrenceIntervalWeeks:1, recurrenceUntil:null, start:'2026-03-15T01:30', end:'2026-03-15T03:30'};
 const response = await probe('2026-03-01Z',[row]);
 const calendar = new ICAL.Component(ICAL.parse(response.body));
 ICAL.TimezoneService.register(new ICAL.Timezone(calendar.getFirstSubcomponent('vtimezone')));
 const components = calendar.getAllSubcomponents('vevent');
 const override = components.find(c => c.getFirstPropertyValue('recurrence-id')?.toString() === '2026-03-29T01:30:00');
 assert.ok(override, 'transition occurrence needs an explicit end correction');
 assert.equal(override.getFirstPropertyValue('uid'),'42@cal72');
 assert.equal(override.getFirstPropertyValue('sequence'),3);
 const master = new ICAL.Event(components[0]);
 master.relateException(new ICAL.Event(override));
 const details = master.getOccurrenceDetails(ICAL.Time.fromString('2026-03-29T01:30:00'));
 assert.equal(details.endDate.toUnixTime(),Date.parse('2026-03-29T01:30:00Z') / 1000);
 assert.equal(override.getFirstPropertyValue('dtend').toUnixTime()-override.getFirstPropertyValue('dtstart').toUnixTime(),3600);
});

test('autumn duration correction uses first ambiguous start and no redundant overrides', async () => {
 const response = await probe('2026-10-01Z',[{...fixture, start:'2026-10-11T02:30',end:'2026-10-11T03:30',recurrenceIntervalWeeks:1,recurrenceUntil:'2026-11-01'}]);
 const components = new ICAL.Component(ICAL.parse(response.body)).getAllSubcomponents('vevent');
 assert.equal(components.length,2);
 const correction = components[1];
 assert.equal(correction.getFirstPropertyValue('recurrence-id').toString(),'2026-10-25T02:30:00');
 assert.equal(correction.getFirstPropertyValue('dtstart').toString(),'2026-10-25T00:30:00Z');
 assert.equal(correction.getFirstPropertyValue('dtend').toString(),'2026-10-25T02:30:00Z');
 assert.equal(correction.hasProperty('rrule'),false);
});

test('chunk boundary retains an already-ended valid Berlin slot', async () => {
 const response = await probe('2026-01-01Z', [{...fixture, start:'2024-01-07T00:15', end:'2024-01-07T00:45', recurrenceIntervalWeeks:1, recurrenceUntil:null}]);
 assert.equal(response.status,200);
 assert.doesNotMatch(response.body,/EXDATE;TZID=Europe\/Berlin:20260104T001500/);
});
test('explicit window compares one-off Berlin instants without rewriting storage', async () => {
 const text = readFileSync('src/lib/server/db/events.ts','utf8');
 const begin = text.indexOf('export const getWebOccurrences =');
 const end = text.indexOf('/** Resolve only', begin);
 const row = {...fixture,start:'2026-07-02T23:00',end:'2026-07-02T23:30',recurrenceIntervalWeeks:null};
 const chain = {from(){return this;},leftJoin(){return this;},where(){return Promise.resolve([row]);}};
 const ctx = vm.createContext({db:{select:()=>chain},eventSelect:{},Events:{},Clubs:{},eq:()=>null,isNull:()=>null,expandOccurrences});
 vm.runInContext(ts.transpile(text.slice(begin,end).replace('export const','const'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None})+'\nglobalThis.list=getWebOccurrences;',ctx);
 const result = await ctx.list(new Date('2026-07-02T20:00Z'),new Date('2026-07-02T22:00Z'));
 assert.equal(result.events.length,1);
 assert.equal(result.events[0].start,row.start);
 assert.equal(result.events[0].end,row.end);
 assert.equal((await ctx.list(new Date('2026-07-02T22:00Z'),new Date('2026-07-03T00:00Z'))).events.length,0);
});
