import { deleteEvent, deleteOccurrence, getWebEvent, getClub } from '$lib/server/db/events';
import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';

const isOneOffId = (id: string) => /^[1-9]\d*$/.test(id);

export const load: PageServerLoad = async ({ params }) => {
	const event = await getWebEvent(params.id);
	let club = null;

	if (event?.club) {
		club = await getClub(event.club.toString());
	}

	// A numeric id naming a series row stays read-only: series-level changes belong to later scopes.
	const isOccurrence = !!event && !isOneOffId(params.id);
	return {
		event,
		club,
		isOccurrence,
		canMutate: !!event && (isOccurrence || event.recurrenceIntervalWeeks === null)
	};
};

export const actions: Actions = {
	delete: async ({ params }) => {
		try {
			if (!isOneOffId(params.id)) {
				// This occurrence only: a deleted past or future slot leaves every other slot intact.
				await deleteOccurrence(params.id);
				console.log(`Occurrence ${params.id} deleted`);
			} else {
				const event = await getWebEvent(params.id);
				if (!event || event.recurrenceIntervalWeeks !== null) return fail(400, { success: false, message: "Unsupported recurring mutation" });
				await deleteEvent(Number(params.id));
				console.log(`Event ${params.id} deleted`);
			}
		} catch (error) {
			console.error(`Error deleting Event ${params.id}`);
			return fail(400, { success: false, message: `Error deleting Event ${params.id}` });
		}
		throw redirect(303, '/events');
	}
};
