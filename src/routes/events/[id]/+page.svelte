<script lang="ts">
	import type { PageProps } from './$types';
	import ConfirmationButton from '$lib/components/ConfirmationButton.svelte';
	import { formatEventTimespan } from '$lib/utils/dateFormat';

	let { data }: PageProps = $props();

	const formattedTimespan =
		data.event?.start && data.event?.end
			? formatEventTimespan(data.event.start, data.event.end, false)
			: '';
</script>

<main class="event-details">
	<div class="event-details__header">
		<h1>{data.event?.title}</h1>

		{#if data.club}
			<div class="event-details__club tag" style:border-color={data.club.color}>
				{data.club.name}
			</div>
		{/if}
	</div>

	<p>
		<time datetime={data.event?.start}>{formattedTimespan}</time>
	</p>

	<p class="event-details__description">{data.event?.description}</p>

	{#if data.canMutate}
	<div class="event-details__actions">
		{#if data.isOccurrence}
			<a class="button" href={`/events/${encodeURIComponent(String(data.event?.id))}/edit`}>Edit this occurrence</a>
			<ConfirmationButton
				message="Delete only this occurrence? The other occurrences of the series are kept."
				action="?/delete"
			>
				Delete this occurrence
			</ConfirmationButton>
		{:else}
			<a class="button" href={`/events/${data.event?.id}/edit`}>Edit</a>
			<ConfirmationButton message="Are you sure you want to delete this event?" action="?/delete">
				Delete Event
			</ConfirmationButton>
		{/if}
	</div>
	{/if}
	<a href="/events">Back to all events</a>
</main>
