import { getWebOccurrences } from "$lib/server/db/events";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async () => {
 const now = new Date();
 const { events, issues } = await getWebOccurrences();
 return {
  futureEvents: events.filter(event => event.end >= now.toISOString()),
  pastEvents: events.filter(event => event.end < now.toISOString()).reverse(),
  occurrenceIssues: issues
 };
};
