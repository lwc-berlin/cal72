import { test, expect } from '@playwright/test';
import ICAL from 'ical.js';

test('one-off creation retains a stable subscription identity', async ({ page, request }) => {
	const title = 'One-off ' + crypto.randomUUID();
	await page.goto('/create');
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
	await expect(page.getByLabel('Repeat every (weeks)')).toHaveValue('0');
});

// Submit through the rendered form with native constraints disabled to exercise the server.
for (const [interval, until] of [
	['-1', ''],
	['1.5', ''],
	['2147483648', ''],
	['0', '2026-07-01'],
	['1', '2026-06-30'],
	['1', '2026-02-30']
]) {
	test(`creation rejects recurrence ${interval} / ${until}`, async ({ page }) => {
		await page.goto('/create');
		await page.getByLabel('Title', { exact: true }).fill('Invalid series');
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
		await page.getByRole('button', { name: 'Create Event' }).click();
		await expect(page.getByText('Invalid recurrence:', { exact: false })).toBeVisible();
		await expect(page.getByText('Event created successfully:', { exact: false })).toHaveCount(0);
	});
}

for (const [interval, until] of [
	['1', ''],
	['2', '2026-07-01'],
	['3', '2026-08-01']
]) {
	test(`creation accepts series ${interval} / ${until}`, async ({ page }) => {
		const title = 'Series ' + crypto.randomUUID();
		await page.goto('/create');
		await page.getByLabel('Title', { exact: true }).fill(title);
		await page.getByLabel('Start', { exact: true }).fill('2026-07-01T19:00');
		await page.getByLabel('End', { exact: true }).fill('2026-07-02T01:00');
		await page.getByLabel('Repeat every (weeks)').fill(interval);
		await page.getByLabel('Repeat until (optional, inclusive)').fill(until);
		await page.getByRole('button', { name: 'Create Event' }).click();
		await expect(page.getByText('Event created successfully: ' + title)).toBeVisible();
	});
}
