<script lang="ts">
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';
	import { Calendar, DayGrid, TimeGrid, Interaction } from '@event-calendar/core';

	let { data }: { data: PageData } = $props();

	let occurrenceIssues = $state(data.occurrenceIssues);
	let loadError = $state('');
	let requestGeneration = 0;

	let currentView = $state('dayGridMonth');
	let calendarDate = $state(new Date());

	function isMobile() {
		return window.matchMedia('(max-width: 768px)').matches;
	}

	let options = $derived({
		view: currentView,
		date: calendarDate,
		dayMaxEvents: true,
		moreLinkContent: (arg: any) => `+${arg.num}`,
		eventSources: [{ events: async (range: { start: Date; end: Date }) => {
            const generation = ++requestGeneration;
            try {
                const query = new URLSearchParams({ start: range.start.toISOString(), end: range.end.toISOString() });
                const response = await fetch(`/api/occurrences?${query}`);
                if (!response.ok) throw new Error('Could not load the requested calendar range.');
                const result = await response.json();
                if (generation === requestGeneration) {
                    occurrenceIssues = result.issues;
                    loadError = '';
                }
                return result.events.map((event: any) => ({ ...event,
                    backgroundColor: event.club?.color || undefined, textColor: 'black' }));
            } catch (error) {
                if (generation === requestGeneration) loadError = 'Could not load the requested calendar range. This view may be incomplete.';
                throw error;
            }
        } }],
		firstDay: 1,
		dateClick: (info: any) => {
			console.log(`Clicked on date: ${JSON.stringify(info.date)}`);

			if (isMobile() && currentView === 'dayGridMonth') {
				calendarDate = info.date;
				currentView = 'timeGridDay';
			} else {
				goto(`/create?date=${info.dateStr}`);
			}
		},
		eventClick: (info: any) => {
			console.log('Event clicked', info.event);
			goto(`/events/${encodeURIComponent(String(info.event.id))}`);
		}
	});

	function setView(view: string) {
		currentView = view;
	}
</script>

<main class="calendar">

	{#if loadError}<p role="alert">{loadError}</p>{/if}
	{#if occurrenceIssues.length > 0}
		<section role="status" aria-label="Recurring event display issues">
			<h2>Some recurring events could not be displayed</h2>
			<p>This view may be incomplete. Other available occurrences remain shown.</p>
			<ul>
				{#each occurrenceIssues as issue}
					<li>Series {issue.seriesId}: {issue.message}</li>
				{/each}
			</ul>
		</section>
	{/if}

	<div class="viewcontroll">
		<button class:active={currentView === 'dayGridMonth'} onclick={() => setView('dayGridMonth')}>
			Month
		</button>
		<button class:active={currentView === 'timeGridWeek'} onclick={() => setView('timeGridWeek')}>
			Week
		</button>
		<button class:active={currentView === 'timeGridDay'} onclick={() => setView('timeGridDay')}>
			Day
		</button>
	</div>

	<Calendar plugins={[DayGrid, TimeGrid, Interaction]} {options} />
</main>
