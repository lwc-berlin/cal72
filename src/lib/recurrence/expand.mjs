const DAY = 86400000;
const formatter = new Intl.DateTimeFormat('en-GB', {
 timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit',
 hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
});
function localStamp(instant) {
 const p = Object.fromEntries(formatter.formatToParts(instant).map(p => [p.type, p.value]));
 return Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second);
}
function date(value) {
 if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new RangeError('Expected YYYY-MM-DD');
 const n = Date.parse(value+'T00:00:00Z');
 if (!Number.isFinite(n) || new Date(n).toISOString().slice(0,10)!==value || value < '1900-01-01' || value > '9998-12-31') throw new RangeError('Date outside supported 1900–9998 range');
 return n;
}
function time(value) {
 if(typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new RangeError('Expected HH:mm');
 return (+value.slice(0,2)*60 + +value.slice(3))*60000;
}
// Probe offsets on both sides of transitions, then round-trip every candidate.
// Sorting chooses the first ambiguous instant; no match means a gap.
function resolve(wall) {
 const offsets = new Set([-2,-1,0,1,2].map(d => localStamp(wall+d*DAY)-(wall+d*DAY)));
 return [...offsets].map(o=>wall-o).filter(n=>localStamp(n)===wall).sort((a,b)=>a-b)[0];
}
/** Pure weekly expansion. Range is half-open epoch milliseconds, matched by overlap.
 * Null interval denotes a non-series and is deliberately rejected (one-offs stay untouched).
 * Missing local end times reject the request rather than silently changing duration.
 */
export function expandOccurrences(schedule, {from, to}) {
 const {seriesId,startDate,startTime,endTime,endDayOffset,recurrenceIntervalWeeks: interval,recurrenceUntil} = schedule;
 if(typeof seriesId !== 'string' || !seriesId) throw new RangeError('seriesId required');
 if(!Number.isSafeInteger(interval) || interval < 1 || interval > 520000) throw new RangeError('Positive bounded interval required');
 if(!Number.isInteger(endDayOffset) || endDayOffset < 0 || endDayOffset > 366) throw new RangeError('endDayOffset must be 0–366');
 if(!Number.isFinite(from) || !Number.isFinite(to) || from >= to || to-from > 3660*DAY || Math.abs(from)>8e15 || Math.abs(to)>8e15) throw new RangeError('Finite ordered range of at most 3660 days required');
 const anchor=date(startDate), startClock=time(startTime), endClock=time(endTime);
 const duration=endDayOffset*DAY+endClock-startClock;
 if(duration<=0) throw new RangeError('Local end must follow local start');
 const until=recurrenceUntil===null ? Infinity : date(recurrenceUntil);
 const step=interval*7*DAY;
 // Include long/overnight occurrences overlapping the lower boundary; never walk from anchor.
 const first=Math.max(0,Math.floor((from-duration-2*DAY-anchor)/step));
 const last=Math.floor((Math.min(to+2*DAY,until)-anchor)/step);
 if(last-first>1000) throw new RangeError('Too many candidate slots');
 const result=[];
 for(let slot=first;slot<=last;slot++) {
  const day=anchor+slot*step;
  const scheduledDate=new Date(day).toISOString().slice(0,10);
  const start=resolve(day+startClock);
  if(start===undefined) continue;
  const end=resolve(day+endDayOffset*DAY+endClock);
  if(end===undefined || end<=start) throw new RangeError('Unresolvable local end');
  if(start<to && end>from) result.push({id:JSON.stringify([seriesId,scheduledDate+'T'+startTime]),scheduledDate,start,end});
 }
 return result;
}
