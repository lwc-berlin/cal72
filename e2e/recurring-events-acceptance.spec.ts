import { test, expect, type Page, type APIRequestContext } from '@playwright/test';
import ICAL from 'ical.js';

// Public-only synthetic fixtures. No runtime execution authorized for this unit.
async function create(page: Page, start: string, end: string) {
 const title = 'Public boundary ' + crypto.randomUUID();
 await page.goto('/create');
 await expect(page.locator('form')).toHaveAttribute('data-hydrated', 'true');
 await page.getByLabel('Title', { exact: true }).fill(title);
 await page.getByLabel('Start', { exact: true }).fill(start);
 await page.getByLabel('End', { exact: true }).fill(end);
 await page.getByLabel('Repeat every (weeks)').fill('1');
 await page.getByRole('button', { name: 'Create Event' }).click();
 await expect(page.getByText('Event created successfully: ' + title, { exact: true })).toBeVisible();
 return title;
}
async function occurrences(request: APIRequestContext, title: string, start: string, end: string) {
 const response = await request.get('/api/occurrences', { params: { start, end } });
 expect(response.status()).toBe(200);
 expect(response.headers()['cache-control']).toBe('no-store');
 const body = await response.json();
 expect(body.issues).toEqual([]);
 return body.events.filter((event: { title: string }) => event.title === title);
}

for (const scenario of [
 { name: 'nonexistent start is skipped', start: '2026-03-22T02:30', end: '2026-03-22T03:30', from: '2026-03-22T00:00:00.000Z', to: '2026-04-06T00:00:00.000Z', expected: [['2026-03-22T01:30:00.000Z', '2026-03-22T02:30:00.000Z'], ['2026-04-05T00:30:00.000Z', '2026-04-05T01:30:00.000Z']] },
 { name: 'nonexistent end skips whole occurrence', start: '2026-03-22T01:30', end: '2026-03-22T02:30', from: '2026-03-22T00:00:00.000Z', to: '2026-04-06T00:00:00.000Z', expected: [['2026-03-22T00:30:00.000Z', '2026-03-22T01:30:00.000Z'], ['2026-04-04T23:30:00.000Z', '2026-04-05T00:30:00.000Z']] },
 { name: 'ambiguous start uses first instance exactly once', start: '2026-10-18T02:30', end: '2026-10-18T03:30', from: '2026-10-18T00:00:00.000Z', to: '2026-11-02T00:00:00.000Z', expected: [['2026-10-18T00:30:00.000Z', '2026-10-18T01:30:00.000Z'], ['2026-10-25T00:30:00.000Z', '2026-10-25T02:30:00.000Z'], ['2026-11-01T01:30:00.000Z', '2026-11-01T02:30:00.000Z']] }
]) {
 test(scenario.name, async ({ page, request }) => {
  const title = await create(page, scenario.start, scenario.end);
  const rows = await occurrences(request, title, scenario.from, scenario.to);
  expect(rows.map((row: { start: string; end: string }) => [row.start, row.end])).toEqual(scenario.expected);
  expect(new Set(rows.map((row: { id: string }) => row.id)).size).toBe(rows.length);
 });
}

test('old anchor is discoverable in a finite later range and recurring mutations fail closed', async ({ page, request }) => {
 const title = await create(page, '2026-01-07T19:00', '2026-01-07T20:00');
 const from = '2026-07-01T00:00:00.000Z', to = '2026-07-09T00:00:00.000Z';
 const before = await occurrences(request, title, from, to);
 expect(before.map((row: { start: string }) => row.start)).toEqual(['2026-07-01T17:00:00.000Z', '2026-07-08T17:00:00.000Z']);
 for (const id of [before[0].id, String(before[0].seriesId)]) {
  const path = '/events/' + encodeURIComponent(id);
  await page.goto(path);
  await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Edit', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Delete Event', exact: true })).toHaveCount(0);
  const edit = await request.get(path + '/edit');
  expect(edit.status()).toBe(400);
  expect(await edit.text()).toContain('Unsupported recurring edit or invalid id');
  const deletion = await request.post(path + '?/delete', { form: {} });
  expect(deletion.status()).toBe(400);
  expect(await deletion.text()).toContain(id === before[0].id ? 'Unsupported occurrence mutation' : 'Unsupported recurring mutation');
  const update = await request.post(path + '/edit', { form: { title: title + ' forbidden', start: '2026-07-01T19:00', end: '2026-07-01T20:00', description: '', club: '' } });
  expect(update.status()).toBe(400);
  expect(await update.text()).toContain('Failed to update event.');
  expect(await occurrences(request, title, from, to)).toEqual(before);
 }
});

test('public feed conditional requests honor ETag and reject timestamp-only recurrence freshness', async ({ page, request }) => {
 await create(page, '2026-01-07T19:00', '2026-01-07T20:00');
 const first = await request.get('/calendar');
 expect(first.status()).toBe(200);
 const etag = first.headers().etag;
 expect(etag).toMatch(/^"[0-9a-f]+"$/);
 expect(first.headers()['cache-control']).toBe('private, max-age=300');
 const cached = await request.get('/calendar', { headers: { 'If-None-Match': etag } });
 expect(cached.status()).toBe(304);
 expect(await cached.text()).toBe('');
 expect(cached.headers().etag).toBe(etag);
 const timestamp = await request.get('/calendar', { headers: { 'If-Modified-Since': first.headers()['last-modified'] } });
 expect(timestamp.status()).toBe(200);
 const changed = await request.get('/calendar', { headers: { 'If-None-Match': '"not-current"', 'If-Modified-Since': first.headers()['last-modified'] } });
 expect(changed.status()).toBe(200);
});

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
	// Subscription deletion is a stable-UID cancellation, not feed removal.
	const cancelled = (await readFeed()).filter(event => event.getFirstPropertyValue('uid') === uid);
	expect(cancelled).toHaveLength(1);
	expect(cancelled[0].getFirstPropertyValue('status')).toBe('CANCELLED');
	expect(cancelled[0].getFirstPropertyValue('summary')).toBe(edited);
	expect(Number(cancelled[0].getFirstPropertyValue('sequence')))
		.toBeGreaterThan(Number(after[0].getFirstPropertyValue('sequence')));
	expect(cancelled[0].getFirstPropertyValue('last-modified')).not.toBeNull();
	const deleted = await request.get(detailUrl);
	expect(deleted.status()).toBe(404);
});
