import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
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
test('nonexistent END is explicitly excluded', () => {
 const calendar = new ICAL.Component(ICAL.parse(serialize({ ...fixture, start:'2026-03-15T01:30', end:'2026-03-15T02:30' })));
 assert.equal(calendar.getFirstSubcomponent('vevent').getFirstPropertyValue('exdate').toString(), '2026-03-29T01:30:00');
});
test('one-off serializer is byte-identical to baseline', () => {
 const event = { ...fixture, recurrenceIntervalWeeks: null };
 const baseline = execFileSync('git', ['show','2db9ceb78c8ffa42532be406b705bf7cd387dfd5:src/routes/calendar/+server.ts'], {encoding:'utf8'}).replace(/^import .*;\n/gm,'').replace('export const GET','const GET');
 const original = vm.createContext({ TextEncoder, console });
 vm.runInContext(ts.transpile(baseline,{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None})+'\nglobalThis.serialize=generateICal;',original);
 assert.equal(serialize(event),original.serialize(new Date('2026-01-01Z'),[event]));
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
