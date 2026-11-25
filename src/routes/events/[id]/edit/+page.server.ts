import { getWebEvent, updateEvent, updateOccurrence, getAllClubs } from '$lib/server/db/events';
import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const event = await getWebEvent(params.id);
	// A numeric id naming a series row stays closed; only one-offs and single occurrences are editable here.
	const isOccurrence = !/^[1-9]\d*$/.test(params.id);
	if (!event || (!isOccurrence && event.recurrenceIntervalWeeks !== null)) error(400, "Unsupported recurring edit or invalid id");
	return {
		event,
		isOccurrence,
		clubs: await getAllClubs()
	};
};

export const actions: Actions = {
	default: async (event) => {
		const formData = await event.request.formData();
		const title = formData.get('title') as string;
		const description = formData.get('description') as string;
		const start = formData.get('start') as string;
		const end = formData.get('end') as string;
		const clubId = formData.get('club') as string;
		const id = event.params.id;

		if (!title || !start || !end) {
			console.error('Form submission error: Missing fields');
			return fail(400, {
				success: false,
				message: 'Missing required fields.',
				title,
				description,
				start,
				end
			});
		}

		if (new Date(start) >= new Date(end)) {
			console.error('Form submission error: Start date must be before end date');
			return fail(400, {
				success: false,
				message: 'Start date must be before end date.',
				title,
				description,
				start,
				end
			});
		}

		try {
			console.log('Received event data:', {
				title,
				description,
				start,
				end,
				club: clubId
			});

			const changes = {
				title,
				description,
				start,
				end,
				club: clubId ? parseInt(clubId) : null
			};
			if (/^[1-9]\d*$/.test(id)) await updateEvent({ id, ...changes });
			else await updateOccurrence(id, changes);

			return { success: true, message: `Event updated successfully: ${title}` };
		} catch (error) {
			console.error('Error updating event:', error);
			return fail(400, {
				success: false,
				message: error instanceof RangeError ? error.message : 'Failed to update event.',
				title,
				description,
				start,
				end
			});
		}
	}
};
