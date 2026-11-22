import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async () => {
	const events: never[] = [];
	const issues: { seriesId: number; message: string }[] = [];
	return { events, occurrenceIssues: issues };
}
