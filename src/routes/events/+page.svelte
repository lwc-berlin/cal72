<script lang="ts">
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';
	import { formatEventTimespan } from '$lib/utils/dateFormat';

	interface EventItem {
		id: number | string;
		title: string;
		start: string;
		end: string;
		club: { id: number; name: string; color: string | null } | null;
	}

	let { data }: { data: PageData } = $props();
</script>

{#snippet eventCard(event: EventItem)}
	<article
		class="event-list__item"
		tabindex="-1"
		onclick={() => goto(`/events/${encodeURIComponent(String(event.id))}`)}
		onkeydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				goto(`/events/${encodeURIComponent(String(event.id))}`);
			}
		}}
	>
		<div class="event-list__item__header">
			<h2><a href={`/events/${encodeURIComponent(String(event.id))}`}>{event.title}</a></h2>
			{#if event.club}
				<div class="event-list__club tag" style:border-color={event.club.color}>
					{event.club.name}
				</div>
			{/if}
		</div>
		<p><time datetime={event.start}>{formatEventTimespan(event.start, event.end, true)}</time></p>
	</article>
{/snippet}

<main class="event-list">
	<h1>Events</h1>

	<p role="note">
		Recurring occurrences are loaded only within 366 days before and after page load.
		Dates outside this range may have recurring events that are not shown.
		One-off events are not limited by this recurrence range.
	</p>
	{#if data.occurrenceIssues.length > 0}
		<section role="status" aria-label="Recurring event display issues">
			<h2>Some recurring events could not be displayed</h2>
			<p>This view may be incomplete. Other available occurrences remain shown.</p>
			<ul>
				{#each data.occurrenceIssues as issue}
					<li>Series {issue.seriesId}: {issue.message}</li>
				{/each}
			</ul>
		</section>
	{/if}


	<h2>Future Events</h2>
	{#each data.futureEvents as event}
		{@render eventCard(event)}
	{:else}
		<p>No upcoming events.</p>
	{/each}

	<details class="event-list__past">
		<summary>Past Events ({data.pastEvents.length})</summary>
		{#each data.pastEvents as event}
			{@render eventCard(event)}
		{/each}
	</details>
</main>
