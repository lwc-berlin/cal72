import { test, expect } from '@playwright/test';
import ICAL from 'ical.js';

// Run only via the isolated synthetic public harness. New assertions are
// unexecuted: the previous integrated run's one-run authorization is exhausted.
test('one-off edit and delete preserve public listing and subscription behavior', async ({ page, request }) => {
	const title = 'One-off lifecycle ' + crypto.randomUUID();
	const edited = title + ' edited';
	const readFeed = async () => {
		const response = await request.get('/calendar');
		expect(response.status()).toBe(200);
		return new ICAL.Component(ICAL.parse(await response.text())).getAllSubcomponents('vevent');
	};
	await page.goto('/create');
	await expect(page.locator('form')).toHaveAttribute('data-hydrated', 'true');
	await page.getByLabel('Title', { exact: true }).fill(title);
	await page.getByLabel('Start', { exact: true }).fill('2026-07-01T19:00');
	await page.getByLabel('End', { exact: true }).fill('2026-07-01T20:00');
	await page.getByRole('button', { name: 'Create Event' }).click();
	await expect(page.getByText('Event created successfully: ' + title, { exact: true })).toBeVisible();
	const before = (await readFeed()).filter(event => event.getFirstPropertyValue('summary') === title);
	expect(before).toHaveLength(1);
	const uid = before[0].getFirstPropertyValue('uid');
	await page.goto('/events');
	await page.getByText(/^Past Events \(/).click();
	await page.getByRole('link', { name: title, exact: true }).click();
	await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible();
	const detailUrl = page.url();
	await page.getByRole('link', { name: 'Edit', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Edit Event', exact: true })).toBeVisible();
	await page.getByLabel('Title', { exact: true }).fill(edited);
	await page.getByRole('button', { name: 'Save Event', exact: true }).click();
	await page.goto(detailUrl);
	await expect(page.getByRole('heading', { level: 1, name: edited, exact: true })).toBeVisible();
	const after = (await readFeed()).filter(event => event.getFirstPropertyValue('uid') === uid);
	expect(after).toHaveLength(1);
	expect(after[0].getFirstPropertyValue('summary')).toBe(edited);
	expect(after[0].getFirstPropertyValue('rrule')).toBeNull();
	page.once('dialog', dialog => dialog.accept());
	await page.getByRole('button', { name: 'Delete Event', exact: true }).click();
	await expect(page).toHaveURL(/\/events$/);
	await expect(page.getByRole('link', { name: edited, exact: true })).toHaveCount(0);
	expect((await readFeed()).filter(event => event.getFirstPropertyValue('uid') === uid)).toHaveLength(0);
	const deleted = await request.get(detailUrl);
	expect(deleted.status()).toBe(404);
});
