declare module '@event-calendar/core' {
	import type { Component } from 'svelte';

	interface Plugin {
		createOptions: (...args: never[]) => void;
		createStores: (...args: never[]) => void;
	}

	interface CalendarOptions {
		view: string;
		date: Date;
		dayMaxEvents: boolean;
		moreLinkContent: (arg: { num: number }) => string;
		eventSources: { events: (range: { start: Date; end: Date }) => Promise<unknown[]> }[];
		firstDay: number;
		dateClick: (info: { date: Date; dateStr: string }) => void;
		eventClick: (info: { event: { id: string } }) => void;
	}

	export const Calendar: Component<{ plugins: Plugin[]; options: CalendarOptions }>;
	export const DayGrid: Plugin;
	export const TimeGrid: Plugin;
	export const Interaction: Plugin;
}
