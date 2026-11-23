import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import ICAL from 'ical.js';

// Ticket 02: change or delete ONE occurrence through the UI, then check the web listing
// and the parsed public ICS feed. Run only through tests/run-public-tests.sh (isolated data).

const DAY = 86400000;
const berlin = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', hourCycle: 'h23',
	year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
const parts = (t: number) => Object.fromEntries(berlin.formatToParts(t).map((x) => [x.type, x.value]));
const localText = (t: number) => { const p = parts(t); return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`; };
// Valid away from DST transitions, which none of these scenarios touch.
function berlinToUtc(local: string) {
	const guess = Date.parse(local + ':00Z');
	const p = parts(guess);
	const offset = Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`) - guess;
	return new Date(guess - offset).toISOString();
}
const plusDays = (date: string, days: number) => new Date(Date.parse(date + 'T00:00:00Z') + days * DAY).toISOString().slice(0, 10);

type Row = { id: string; seriesId: number; title: string; start: string; end: string; scheduledDate: string };
const cases = [
	{ name: 'ended', start: '2026-07-01T19:00', end: '2026-07-01T20:00', target: 1 },
	{ name: 'future', start: '2027-03-03T19:00', end: '2027-03-03T20:00', target: 1 },
	{ name: 'in progress', start: localText(Date.now() - 30 * 60000), end: localText(Date.now() + 30 * 60000), target: 0 }
];

async function create(page: Page, start: string, end: string) {
	const title = 'Occurrence exception ' + crypto.randomUUID();
	await page.goto('/create');
	await expect(page.locator('form')).toHaveAttribute('data-hydrated', 'true');
	await page.getByLabel('Title', { exact: true }).fill(title);
	await page.getByLabel('Description', { exact: true }).fill('Inherited description');
	await page.getByLabel('Start', { exact: true }).fill(start);
	await page.getByLabel('End', { exact: true }).fill(end);
	await page.getByLabel('Repeat every (weeks)').fill('1');
	await page.getByRole('button', { name: 'Create Event' }).click();
	await expect(page.getByText('Event created successfully: ' + title, { exact: true })).toBeVisible();
	return title;
}
async function listing(request: APIRequestContext, start: string, titles: string[]): Promise<Row[]> {
	const day = start.slice(0, 10);
	const params = { start: plusDays(day, -2) + 'T00:00:00.000Z', end: plusDays(day, 24) + 'T00:00:00.000Z' };
	const response = await request.get('/api/occurrences', { params });
	expect(response.status()).toBe(200);
	const body = await response.json();
	expect(body.issues).toEqual([]);
	return body.events.filter((event: Row) => titles.includes(event.title));
}
async function feed(request: APIRequestContext, seriesId: number) {
	const calendar = new ICAL.Component(ICAL.parse(await (await request.get('/calendar')).text()));
	ICAL.TimezoneService.register(new ICAL.Timezone(calendar.getFirstSubcomponent('vtimezone')));
	const events = calendar.getAllSubcomponents('vevent')
		.filter((component) => component.getFirstPropertyValue('uid') === `${seriesId}@cal72`)
		.map((component) => new ICAL.Event(component));
	const master = events.find((event) => !event.recurrenceId)!;
	for (const override of events.filter((event) => event.recurrenceId)) master.relateException(override);
	return { events, master, details: (local: string) => master.getOccurrenceDetails(ICAL.Time.fromString(local + ':00')) };
}

for (const scenario of cases) {
	test(`${scenario.name}: editing one occurrence moves only it and publishes an override`, async ({ page, request }) => {
		const title = await create(page, scenario.start, scenario.end);
		const before = await listing(request, scenario.start, [title]);
		expect(before.length).toBeGreaterThanOrEqual(3);
		const target = before[scenario.target];
		const slotDate = target.scheduledDate;
		const movedStart = plusDays(slotDate, 1) + 'T10:00';
		const movedEnd = plusDays(slotDate, 1) + 'T11:30';

		await page.goto('/events/' + encodeURIComponent(target.id));
		await page.getByRole('link', { name: 'Edit this occurrence', exact: true }).click();
		await expect(page.getByRole('heading', { name: 'Edit this occurrence', exact: true })).toBeVisible();
		await expect(page.locator('form')).toHaveAttribute('data-hydrated', 'true');
		await expect(page.getByLabel('Title', { exact: true })).toHaveValue(title);
		await page.getByLabel('Title', { exact: true }).fill(title + ' special');
		await page.getByLabel('Start', { exact: true }).fill(movedStart);
		await page.getByLabel('End', { exact: true }).fill(movedEnd);
		await page.getByRole('button', { name: 'Save this occurrence', exact: true }).click();
		await expect(page.getByText('Event updated successfully: ' + title + ' special', { exact: true })).toBeVisible();

		// Web: same identity, no original-plus-moved duplicate, every other slot untouched.
		const after = await listing(request, scenario.start, [title, title + ' special']);
		expect(after).toHaveLength(before.length);
		const changed = after.find((row) => row.id === target.id)!;
		expect(changed.title).toBe(title + ' special');
		expect(changed.start).toBe(berlinToUtc(movedStart));
		expect(changed.end).toBe(berlinToUtc(movedEnd));
		expect(after.filter((row) => row.id !== target.id)).toEqual(before.filter((row) => row.id !== target.id));

		// Feed: a RECURRENCE-ID override for the original slot; master and siblings keep the series values.
		const { events, master, details } = await feed(request, target.seriesId);
		const overrides = events.filter((event) => event.recurrenceId);
		expect(overrides).toHaveLength(1);
		const originalLocal = scenario.start.slice(11);
		expect(overrides[0].recurrenceId.toString()).toBe(`${slotDate}T${originalLocal}:00`);
		expect(master.summary).toBe(title);
		const moved = details(`${slotDate}T${originalLocal}`);
		expect(moved.item.summary).toBe(title + ' special');
		expect(moved.item.description).toBe('Inherited description');
		expect(moved.startDate.toString()).toBe(movedStart + ':00');
		expect(moved.endDate.toString()).toBe(movedEnd + ':00');
		const sibling = before.find((row) => row.id !== target.id)!;
		expect(details(`${sibling.scheduledDate}T${originalLocal}`).item.summary).toBe(title);
	});

	test(`${scenario.name}: deleting one occurrence keeps the rest and publishes a cancellation`, async ({ page, request }) => {
		const title = await create(page, scenario.start, scenario.end);
		const before = await listing(request, scenario.start, [title]);
		const target = before[scenario.target];
		const url = '/events/' + encodeURIComponent(target.id);
		await page.goto(url);
		page.once('dialog', (dialog) => dialog.accept());
		await page.getByRole('button', { name: 'Delete this occurrence', exact: true }).click();
		await expect(page).toHaveURL(/\/events$/);

		const after = await listing(request, scenario.start, [title]);
		expect(after).toEqual(before.filter((row) => row.id !== target.id));
		// A series edit-free repeat of the same request cannot resurrect or double-delete it.
		const again = await request.post(url + '?/delete', { headers: { Accept: 'text/html' }, form: {} });
		expect(again.status()).toBe(400);
		expect(await listing(request, scenario.start, [title])).toEqual(after);

		const { events, master, details } = await feed(request, target.seriesId);
		const cancelled = events.filter((event) => event.recurrenceId);
		expect(cancelled).toHaveLength(1);
		expect(cancelled[0].component.getFirstPropertyValue('status')).toBe('CANCELLED');
		expect(cancelled[0].sequence).toBeGreaterThan(master.sequence);
		const sibling = before.find((row) => row.id !== target.id)!;
		expect(details(`${sibling.scheduledDate}T${scenario.start.slice(11)}`).item.component.getFirstPropertyValue('status')).toBeNull();
	});
}

test('a second edit keeps earlier overrides and unrelated slots stay inherited', async ({ page, request }) => {
	const title = await create(page, '2026-07-01T19:00', '2026-07-01T20:00');
	const before = await listing(request, '2026-07-01', [title]);
	const target = before[1];
	const url = '/events/' + encodeURIComponent(target.id) + '/edit';
	await page.goto(url);
	await expect(page.locator('form')).toHaveAttribute('data-hydrated', 'true');
	await page.getByLabel('Title', { exact: true }).fill(title + ' custom');
	await page.getByRole('button', { name: 'Save this occurrence', exact: true }).click();
	await expect(page.getByText('Event updated successfully', { exact: false })).toBeVisible();
	await page.goto(url);
	await expect(page.locator('form')).toHaveAttribute('data-hydrated', 'true');
	await expect(page.getByLabel('Title', { exact: true })).toHaveValue(title + ' custom');
	await expect(page.getByLabel('Start', { exact: true })).toHaveValue('2026-07-08T19:00');
	await page.getByLabel('Description', { exact: true }).fill('Only here');
	await page.getByRole('button', { name: 'Save this occurrence', exact: true }).click();
	await expect(page.getByText('Event updated successfully', { exact: false })).toBeVisible();
	const { details } = await feed(request, target.seriesId);
	const edited = details('2026-07-08T19:00:00'.slice(0, 16));
	expect(edited.item.summary).toBe(title + ' custom');
	expect(edited.item.description).toBe('Only here');
	expect(edited.startDate.toString()).toBe('2026-07-08T19:00:00');
	expect(details('2026-07-15T19:00').item.summary).toBe(title);
	expect(details('2026-07-15T19:00').item.description).toBe('Inherited description');
});

test('invalid occurrence changes are rejected without altering anything', async ({ page, request }) => {
	const title = await create(page, '2026-07-01T19:00', '2026-07-01T20:00');
	const before = await listing(request, '2026-07-01', [title]);
	const target = before[1];
	const url = '/events/' + encodeURIComponent(target.id) + '/edit';
	await page.goto(url);
	await expect(page.locator('form')).toHaveAttribute('data-hydrated', 'true');
	await page.getByLabel('Title', { exact: true }).fill('must not be stored');
	await page.getByLabel('Start', { exact: true }).fill('2026-07-08T21:00');
	await page.getByLabel('End', { exact: true }).fill('2026-07-08T20:00');
	await page.getByRole('button', { name: 'Save this occurrence', exact: true }).click();
	await expect(page.getByText('Start date must be before end date.')).toBeVisible();
	const gap = await request.post(url, { headers: { Accept: 'text/html' },
		form: { title: 'gap', description: '', start: '2027-03-28T02:30', end: '2027-03-28T03:30', club: '' } });
	expect(gap.status()).toBe(400);
	expect(await listing(request, '2026-07-01', [title, 'must not be stored', 'gap'])).toEqual(before);
	// Ids that are not a produced slot (wrong weekday, wrong time, malformed) stay closed.
	for (const id of [JSON.stringify([String(target.seriesId), '2026-07-09T19:00']),
		JSON.stringify([String(target.seriesId), '2026-07-08T18:00']), '[1,"2026-07-08T19:00"]']) {
		const response = await request.get('/events/' + encodeURIComponent(id) + '/edit');
		expect(response.status()).toBe(400);
		const deletion = await request.post('/events/' + encodeURIComponent(id) + '?/delete', { headers: { Accept: 'text/html' }, form: {} });
		expect(deletion.status()).toBe(400);
	}
});

test('one-off events keep their own edit and delete actions', async ({ page }) => {
	const title = 'One-off beside series ' + crypto.randomUUID();
	await page.goto('/create');
	await expect(page.locator('form')).toHaveAttribute('data-hydrated', 'true');
	await page.getByLabel('Title', { exact: true }).fill(title);
	await page.getByLabel('Start', { exact: true }).fill('2026-07-01T19:00');
	await page.getByLabel('End', { exact: true }).fill('2026-07-01T20:00');
	await page.getByRole('button', { name: 'Create Event' }).click();
	await page.goto('/events');
	await page.getByText(/^Past Events \(/).click();
	await page.getByRole('link', { name: title, exact: true }).click();
	await expect(page.getByRole('link', { name: 'Edit', exact: true })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Delete Event', exact: true })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Edit this occurrence' })).toHaveCount(0);
});
