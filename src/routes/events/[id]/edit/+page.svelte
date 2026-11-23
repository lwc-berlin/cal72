<script lang="ts">
	import { onMount } from 'svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	// Lets browser tests wait until hydration cannot overwrite typed values.
	let hydrated = $state(false);
	onMount(() => { hydrated = true; });

	// Convert ISO string to datetime-local format
	const formatDateTime = (isoString: string) => {
		const date = new Date(isoString);
		return date.toISOString().slice(0, 16);
	};

	// Occurrences carry Berlin wall-clock text; one-offs keep their stored value.
	const localValue = (key: 'localStart' | 'localEnd', fallback?: string) => {
		const event = data.event;
		if (event && 'localStart' in event) return key === 'localStart' ? event.localStart : event.localEnd;
		return fallback ? formatDateTime(fallback) : '';
	};
</script>

<main class="event-edit">
	<h1>{data.isOccurrence ? 'Edit this occurrence' : 'Edit Event'}</h1>
	{#if data.isOccurrence}
		<p>
			Changes apply to this occurrence only. Fields you leave unchanged keep following the series.
		</p>
	{/if}
	<form method="POST" data-hydrated={hydrated}>
		{#if form?.success == false}<p class="alert error">{form?.message}</p>{/if}
		{#if form?.success}<p class="alert success">{form?.message}</p>{/if}

		<label>
			Title
			<input
				type="text"
				name="title"
				placeholder="Event title"
				required
				value={data.event?.title ?? ''}
			/>
		</label>

		<label>
			Description
			<textarea name="description" placeholder="Description of the Event" rows="3"
				>{data.event?.description ?? ''}</textarea
			>
		</label>

		<div class="create-event__dates">
			<label>
				Start
				<input
					type="datetime-local"
					name="start"
					required
					value={localValue('localStart', data.event?.start)}
				/>
			</label>
			<label>
				End
				<input
					type="datetime-local"
					name="end"
					required
					value={localValue('localEnd', data.event?.end)}
				/>
			</label>
		</div>

		<label>
			Club (optional)
			<select name="club">
				<option value="">No club</option>
				{#each data.clubs as club}
					<option value={club.id} selected={data.event?.club === club.id}>
						{club.name}
					</option>
				{/each}
			</select>
		</label>

		<button class="success" type="submit">{data.isOccurrence ? 'Save this occurrence' : 'Save Event'}</button>
	</form>
</main>
