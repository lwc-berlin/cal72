import { getWebOccurrences } from "$lib/server/db/events";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async () => {
	const { events, issues } = await getWebOccurrences();
	return { events, occurrenceIssues: issues };
}
