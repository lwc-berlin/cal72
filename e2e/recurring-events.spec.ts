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
