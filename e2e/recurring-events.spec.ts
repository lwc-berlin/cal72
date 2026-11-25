import { test, expect } from '@playwright/test';
import ICAL from 'ical.js';

test('one-off creation retains a stable subscription identity', async ({ page, request }) => {
	const title = 'One-off ' + crypto.randomUUID();
	await page.goto('/create');
	await expect(page.locator('form')).toHaveAttribute('data-hydrated', 'true');
	await page.getByLabel('Title', { exact: true }).fill(title);
	await page.getByLabel('Start', { exact: true }).fill('2026-07-01T19:00');
	await page.getByLabel('End', { exact: true }).fill('2026-07-01T20:00');
	await page.getByRole('button', { name: 'Create Event' }).click();
	await expect(page.getByText('Event created successfully: ' + title)).toBeVisible();
	const response = await request.get('/calendar');
	expect(response.ok()).toBeTruthy();
	const calendar = new ICAL.Component(ICAL.parse(await response.text()));
	const event = calendar
		.getAllSubcomponents('vevent')
		.find((component) => component.getFirstPropertyValue('summary') === title);
	expect(event).toBeDefined();
	expect(event!.getFirstPropertyValue('uid')).toMatch(/^\d+@cal72$/);
	expect(event!.getFirstPropertyValue('rrule')).toBeNull();
});

test('organizer can opt into weekly recurrence', async ({ page }) => {
	await page.goto('/create');
	await expect(page.locator('form')).toHaveAttribute('data-hydrated', 'true');
	await expect(page.getByLabel('Repeat every (weeks)')).toHaveValue('0');
});

// Submit through the rendered form with native constraints disabled to exercise the server.
for (const [interval, until] of [
	['-1', ''],
	['abc', ''],
	['', ''], // An omitted field defaults to 0; an explicitly empty field fails validation.
	['1.5', ''],
	['2147483648', ''],
	['0', '2026-07-01'],
	['1', '2026-06-30'],
	['1', '2026-02-30']
]) {
	test(`creation rejects recurrence ${interval} / ${until}`, async ({ page }) => {
		const title = 'Rejected series ' + crypto.randomUUID();
		await page.goto('/create');
	await expect(page.locator('form')).toHaveAttribute('data-hydrated', 'true');
		await page.getByLabel('Title', { exact: true }).fill(title);
		await page.getByLabel('Start', { exact: true }).fill('2026-07-01T19:00');
		await page.getByLabel('End', { exact: true }).fill('2026-07-01T20:00');
		await page.locator('form').evaluate(
			(form, values) => {
				form.noValidate = true;
				for (const [name, value] of Object.entries(values)) {
					const input = form.querySelector<HTMLInputElement>(`[name="${name}"]`)!;
					input.type = 'text';
					input.value = value;
				}
			},
			{ recurrenceIntervalWeeks: interval, recurrenceUntil: until }
		);
		const actionResponse = page.waitForResponse(
			(response) => new URL(response.url()).pathname === '/create' && response.request().method() === 'POST'
		);
		await page.getByRole('button', { name: 'Create Event' }).click();
		const response = await actionResponse;
		// Native form submissions use HTTP 400; enhanced actions can wrap it in HTTP 200.
		if (response.headers()['content-type']?.includes('application/json')) {
			expect(await response.json()).toMatchObject({ type: 'failure', status: 400 });
		} else {
			expect(response.status()).toBe(400);
		}
		await expect(page.getByText(
			'Invalid recurrence: use a whole number of weeks and an end date on or after the start date.',
			{ exact: true }
		)).toBeVisible();
		await expect(page.getByText('Event created successfully:', { exact: false })).toHaveCount(0);
		await page.goto('/events');
		await expect(page.getByRole('link', { name: title, exact: true })).toHaveCount(0);
	});
}

for (const [interval, until] of [
	['1', ''],
	['2', '2026-07-01'],
	['3', '2026-08-01']
]) {
	test(`creation accepts series ${interval} / ${until}`, async ({ page, request }) => {
		const title = 'Series ' + crypto.randomUUID();
		await page.goto('/create');
	await expect(page.locator('form')).toHaveAttribute('data-hydrated', 'true');
		await page.getByLabel('Title', { exact: true }).fill(title);
		await page.getByLabel('Start', { exact: true }).fill('2026-07-01T19:00');
		await page.getByLabel('End', { exact: true }).fill('2026-07-02T01:00');
		await page.getByLabel('Repeat every (weeks)').fill(interval);
		await page.getByLabel('Repeat until (optional, inclusive)').fill(until);
		await page.getByRole('button', { name: 'Create Event' }).click();
		await expect(page.getByText('Event created successfully: ' + title, { exact: true })).toBeVisible();
		await page.goto('/events');
		// Open past occurrences before querying accessible links. A recurring title
		// legitimately occurs many times; identify the anchor by its displayed instant.
		await page.getByText(/^Past Events \(/).click();
		const cards = page.locator('article').filter({
			has: page.getByRole('link', { name: title, exact: true })
		});
		const anchor = cards.filter({
			has: page.locator('time[datetime="2026-07-01T17:00:00.000Z"]')
		});
		await expect(anchor).toHaveCount(1);
		if (until) await expect(cards).toHaveCount(interval === '2' ? 1 : 2);
		const eventLink = anchor.getByRole('link', { name: title, exact: true });
		await expect(eventLink).toHaveAttribute('href', /2026-07-01T19%3A00/);
		const occurrenceHref = await eventLink.getAttribute('href');
		expect(occurrenceHref).not.toBeNull();
		const occurrenceUrl = new URL(occurrenceHref!, page.url()).href;
		await eventLink.click();
		await expect(page).toHaveURL(occurrenceUrl);
		const detailHeading = page.getByRole('heading', { level: 1, name: title, exact: true });
		await expect(detailHeading).toBeVisible();
		const detail = page.getByRole('main').filter({ has: detailHeading });
		await expect(detail).toHaveCount(1);
		const scheduledStart = detail.locator('time');
		await expect(scheduledStart).toHaveCount(1);
		// The detail payload serializes the 19:00 Berlin scheduled start as UTC.
		await expect(scheduledStart).toHaveAttribute('datetime', '2026-07-01T17:00:00.000Z');
		// Public feed, parsed rather than matched as serialized text. These assertions
		// have not yet been executed in the isolated integrated harness.
		const feed = await request.get('/calendar');
		expect(feed.status()).toBe(200);
		const components = new ICAL.Component(ICAL.parse(await feed.text()))
			.getAllSubcomponents('vevent');
		const masters = components.filter((event) =>
			event.getFirstPropertyValue('summary') === title &&
			!event.hasProperty('recurrence-id'));
		expect(masters).toHaveLength(1);
		const master = masters[0];
		const rule = master.getFirstPropertyValue('rrule') as ICAL.Recur;
		expect(rule.freq).toBe('WEEKLY');
		expect(rule.interval).toBe(Number(interval));
		expect(Boolean(rule.until)).toBe(Boolean(until));
		const parsedEvent = new ICAL.Event(master);
		expect(parsedEvent.startDate.toString()).toBe('2026-07-01T19:00:00');
		expect(parsedEvent.endDate.toString()).toBe('2026-07-02T01:00:00');
		const iterator = parsedEvent.iterator();
		const first = iterator.next()!;
		expect(first.toString()).toBe('2026-07-01T19:00:00');
		const second = iterator.next();
		// RecurExpansion returns undefined at exhaustion; complete documents termination.
		if (interval === '2') {
			expect(second).toBeUndefined();
			expect(iterator.complete).toBe(true);
		}
		else expect(second!.toString()).toBe(interval === '1'
			? '2026-07-08T19:00:00' : '2026-07-22T19:00:00');
		if (interval === '3') {
			expect(iterator.next()).toBeUndefined();
			expect(iterator.complete).toBe(true);
		}
		const refreshed = await request.get('/calendar');
		expect(refreshed.status()).toBe(200);
		const same = new ICAL.Component(ICAL.parse(await refreshed.text()))
			.getAllSubcomponents('vevent').find((event) =>
				event.getFirstPropertyValue('summary') === title && !event.hasProperty('recurrence-id'));
		expect(same?.getFirstPropertyValue('uid')).toBe(master.getFirstPropertyValue('uid'));
	});
}
