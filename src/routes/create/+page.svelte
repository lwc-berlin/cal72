<script lang="ts">
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<main class="create-event">
	<h1>Create New Event</h1>
	<form method="post">
		{#if form?.success == false}<p class="alert error">{form?.message}</p>{/if}
		{#if form?.success}<p class="alert success">{form?.message}</p>{/if}

		<label>
			Title
			<input
				type="text"
				name="title"
				placeholder="Event title"
				required
				value={form?.title ?? ''}
			/>
		</label>

		<label>
			Description
			<textarea name="description" placeholder="Description of the Event" rows="3"
				>{form?.description ?? ''}</textarea
			>
		</label>

		<div class="create-event__dates">
			<label>
				Start
				<input type="datetime-local" name="start" required value={form?.start ?? data.date ?? ''} />
			</label>
			<label>
				End
				<input type="datetime-local" name="end" required value={form?.end ?? data.date ?? ''} />
			</label>
		</div>

		<label>
			Repeat every (weeks)
			<input
				type="number"
				name="recurrenceIntervalWeeks"
				min="0"
				max="2147483647"
				step="1"
				value={form?.recurrenceIntervalWeeks ?? '0'}
				aria-describedby="recurrence-help"
			/>
		</label>
		<p id="recurrence-help">
			0 means no repeat. Use 1 for weekly, or a larger number for every N weeks.
		</p>
		<label>
			Repeat until (optional, inclusive)
			<input type="date" name="recurrenceUntil" value={form?.recurrenceUntil ?? ''} />
		</label>
		<p>For repeating events, choose an end date or leave it empty to repeat indefinitely.</p>

		<label>
			Club (optional)
			<select name="club">
				<option value="">No club</option>
				{#each data.clubs as club}
					<option value={club.id}>
						{club.name}
					</option>
				{/each}
			</select>
		</label>

		<button class="success" type="submit">Create Event</button>
	</form>
</main>
