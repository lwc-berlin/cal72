import type { Actions, PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';
import { createEvent, getAllClubs } from '$lib/server/db/events';

export const load: PageServerLoad = async () => {
	return {
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
		const intervalInput = formData.get('recurrenceIntervalWeeks') ?? '0';
		const untilInput = formData.get('recurrenceUntil') ?? '';
		const recurrenceIntervalWeeks = Number(intervalInput) || null;
		const recurrenceUntil = typeof untilInput === 'string' && untilInput ? untilInput : null;
		const validDate = (value: string) =>
			/^\d{4}-\d{2}-\d{2}$/.test(value) &&
			Number.isFinite(Date.parse(value)) &&
			new Date(value).toISOString().slice(0, 10) === value;

		if (
			typeof intervalInput !== 'string' ||
			!/^\d+$/.test(intervalInput) ||
			!Number.isSafeInteger(Number(intervalInput)) ||
			Number(intervalInput) > 2147483647 ||
			typeof untilInput !== 'string' ||
			(recurrenceUntil !== null &&
				(!recurrenceIntervalWeeks ||
					!validDate(recurrenceUntil) ||
					!validDate(start?.slice(0, 10) ?? '') ||
					recurrenceUntil < start.slice(0, 10)))
		) {
			return fail(400, {
				success: false,
				message:
					'Invalid recurrence: use a whole number of weeks and an end date on or after the start date.',
				title,
				description,
				start,
				end,
				recurrenceIntervalWeeks: typeof intervalInput === 'string' ? intervalInput : '0',
				recurrenceUntil: typeof untilInput === 'string' ? untilInput : ''
			});
		}

		if (!title || !start || !end) {
			console.error('Form submission error: Missing fields');
			return fail(400, {
				success: false,
				message: 'Missing field.',
				title,
				description,
				start,
				end,
				recurrenceIntervalWeeks: String(intervalInput),
				recurrenceUntil: String(untilInput)
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
				end,
				recurrenceIntervalWeeks: String(intervalInput),
				recurrenceUntil: String(untilInput)
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

			await createEvent({
				title,
				description,
				start: start,
				end: end,
				club: clubId ? parseInt(clubId) : null,
				recurrenceIntervalWeeks,
				recurrenceUntil
			});

			return { success: true, message: `Event created successfully: ${title}` };
		} catch (error) {
			console.error('Error creating event:', error);
			return fail(400, {
				success: false,
				message: 'Failed to create event.',
				title,
				description,
				start,
				end,
				recurrenceIntervalWeeks: String(intervalInput),
				recurrenceUntil: String(untilInput)
			});
		}
	}
};
