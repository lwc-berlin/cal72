import { getWebOccurrences } from '$lib/server/db/events';
import type { RequestHandler } from './$types';

// Explicit canonical UTC instants only: reject normalized impossible dates too.
export const GET: RequestHandler = async ({ url }) => {
 const values = ['start', 'end'].map(key => url.searchParams.getAll(key));
 const dates = values.map(([value]) => new Date(value ?? ''));
 if (values.some(value => value.length !== 1) || dates.some((date, i) =>
  !Number.isFinite(date.getTime()) || date.toISOString() !== values[i][0]) ||
  dates[0] >= dates[1] || dates[1].getTime() - dates[0].getTime() > 3660 * 86400000) {
  return Response.json({ error: 'Explicit ordered UTC ISO dates spanning at most 3660 days required' }, { status: 400 });
 }
 return Response.json(await getWebOccurrences(dates[0], dates[1]), {
  headers: { 'Cache-Control': 'no-store' }
 });
};
