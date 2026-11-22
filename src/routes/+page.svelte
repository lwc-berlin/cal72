<script lang="ts">
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';
	import { Calendar, DayGrid, TimeGrid, Interaction } from '@event-calendar/core';

	let { data }: { data: PageData } = $props();

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
		events: data.events.map((event: any) => ({
			...event,
			backgroundColor: event.club?.color || undefined,
			textColor: 'black'
		})),
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

	<p role="note">
		Recurring occurrences are loaded only within 366 days before and after page load.
		Dates outside this range may have recurring events that are not shown.
		Calendar navigation does not load additional occurrences.
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
