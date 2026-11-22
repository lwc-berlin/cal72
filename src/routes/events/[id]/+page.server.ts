import { deleteEvent, getWebEvent, getClub } from '$lib/server/db/events';
import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params }) => {
	const event = await getWebEvent(params.id);
	let club = null;

	if (event?.club) {
		club = await getClub(event.club.toString());
	}

	return {
		event,
		club,
		canMutate: !!event && event.recurrenceIntervalWeeks === null
	};
};

export const actions: Actions = {
	delete: async ({ params }) => {
		try {
			if (!/^[1-9]\d*$/.test(params.id)) return fail(400, { success: false, message: "Unsupported occurrence mutation" });
			const event = await getWebEvent(params.id);
			if (!event || event.recurrenceIntervalWeeks !== null) return fail(400, { success: false, message: "Unsupported recurring mutation" });
			await deleteEvent(Number(params.id));
			console.log(`Event ${params.id} deleted`);
		} catch (error) {
			console.error(`Error deleting Event ${params.id}`);
			return fail(400, { success: false, message: `Error deleting Event ${params.id}` });
		}
		throw redirect(303, '/events');
	}
};
