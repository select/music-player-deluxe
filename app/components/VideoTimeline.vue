<template>
	<div
		class="fixed inset-0 h-screen flex flex-col justify-center pl-3 w-24"
		@wheel.prevent.stop
	>
		<!-- Current date (top) -->
		<div class="text-xs text-primary-3 text-center mb-1">
			{{ currentTime.format("YYYY MMM D") }}
		</div>

		<div
			class="relative"
			@mouseenter="isHoveringTimeline = true"
			@mouseleave="isHoveringTimeline = false"
		>
			<svg
				ref="svgElement"
				class=""
				width="85"
				height="800"
				viewBox="0 0 85 800"
				xmlns="http://www.w3.org/2000/svg"
			>
				<!-- Timeline marks -->
				<g v-for="(mark, index) in timelineMarks" :key="index">
					<!-- Major unit marks (longer dashes) -->
					<line
						v-if="mark.isMajor"
						:x1="68"
						:x2="80"
						:y1="mark.y"
						:y2="mark.y"
						stroke="currentColor"
						stroke-width="2"
						class="text-primary-4"
					/>
					<!-- Minor unit marks (shorter dashes) -->
					<line
						v-else
						:x1="72"
						:x2="80"
						:y1="mark.y"
						:y2="mark.y"
						stroke="currentColor"
						stroke-width="1"
						class="text-primary-3"
					/>
					<!-- Time labels for major marks -->
					<text
						v-if="mark.isMajor && mark.label"
						:x="60"
						:y="mark.y + 4"
						class="text-xs fill-primary-3"
						text-anchor="end"
					>
						{{ mark.label }}
					</text>
				</g>

				<!-- Visible videos time range box -->
				<rect
					v-if="visibleVideosBox"
					:x="visibleVideosBox.x"
					:y="visibleVideosBox.y"
					:width="visibleVideosBox.width"
					:height="visibleVideosBox.height"
					class="fill-accent stroke-accent stroke-2"
					fill-opacity="0.3"
					stroke-opacity="1"
					rx="4"
					ry="4"
					style="transition: all 0.3s ease-in-out"
				/>
			</svg>

			<!-- Scroll Indicator Overlay -->
			<div
				v-if="isHoveringTimeline"
				class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none transition-opacity duration-200"
			>
				<!-- Zoom In Arrow (Up) -->
				<div class="flex flex-col items-center mb-4 text-accent animate-pulse">
					<div class="i-mdi-chevron-up text-2xl mb-1" />
					<div class="i-mdi-magnify-plus text-lg" />
				</div>

				<!-- Scroll Icon -->
				<div class="flex items-center justify-center mb-4">
					<div class="i-mdi-mouse text-3xl text-accent" />
				</div>

				<!-- Zoom Out Arrow (Down) -->
				<div class="flex flex-col items-center text-accent animate-pulse">
					<div class="i-mdi-magnify-minus text-lg" />
					<div class="i-mdi-chevron-down text-2xl mt-1" />
				</div>
			</div>
		</div>

		<!-- Oldest date (bottom) -->
		<div class="text-xs text-primary-3 text-center mt-1">
			{{ currentTime.subtract(currentTimespan, "second").format("YYYY MMM D") }}
		</div>
	</div>

	<div class="ml-30">
		<VideoGrid
			v-if="filteredVideos.length > 0"
			:videos="filteredVideos"
			:highlight-video-id="props.highlightVideoId"
			@play="handleVideoPlay"
			@visible-videos-change="handleVisibleVideosChange"
		/>

		<div
			v-else
			class="flex flex-col items-center justify-center h-full text-primary-3"
		>
			<div class="i-mdi-calendar-remove text-6xl mb-4 opacity-50" />
			<p class="text-lg">No videos found in this time range</p>
		</div>
	</div>
</template>

<script setup lang="ts">
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import relativeTime from "dayjs/plugin/relativeTime";
import customParseFormat from "dayjs/plugin/customParseFormat";
import duration from "dayjs/plugin/duration";
import { useEventListener, useThrottleFn, useDebounceFn } from "@vueuse/core";
import type { Video } from "~/types";

const props = withDefaults(
	defineProps<{
		videos?: Video[];
		highlightVideoId?: string;
	}>(),
	{
		videos: () => [],
		highlightVideoId: "",
	},
);

const emit = defineEmits<{
	play: [video: Video];
}>();

dayjs.extend(utc);
dayjs.extend(relativeTime);
dayjs.extend(customParseFormat);
dayjs.extend(duration);

// Get videos from playlist store
const { currentVideos } = storeToRefs(usePlaylistStore());

// Filter videos based on current timespan (show only older videos)
const filteredVideos = computed(() => {
	const timeStart = currentTime.value.subtract(currentTimespan.value, "second");
	const timeEnd = currentTime.value;

	return currentVideos.value.filter((video) => {
		if (!video.createdAt) return false;
		const videoDate = dayjs(video.createdAt);
		return videoDate.isAfter(timeStart) && videoDate.isBefore(timeEnd);
	});
});

// Handle video play events
const handleVideoPlay = (video: Video) => {
	emit("play", video);
};

interface TimeUnit {
	length: number;
	label: string;
	unitName: dayjs.ManipulateType;
	format: string;
	maxTimespan: number;
	alignmentUnit: dayjs.ManipulateType;
	alignmentDivisor: number;
	incrementAmount: number;
	incrementUnit: dayjs.ManipulateType;
}

interface TimelineMark {
	y: number;
	isMajor: boolean;
	time: dayjs.Dayjs;
	label?: string;
}

const SVG_HEIGHT = 800;
const MIN_TIMESPAN = 1800; // 30 minutes minimum
const MAX_TIMESPAN = 157784760; // 5 years maximum
const BASE_SCALE = 1.15;
const THROTTLE_DELAY = 50;

const currentTimespan = ref<number>(1728000); // 20 days
const currentTime = ref<dayjs.Dayjs>(dayjs());
const svgElement = ref<SVGElement>();
const isHoveringTimeline = ref<boolean>(false);

const timeUnits: TimeUnit[] = [
	{
		length: 1,
		label: "s",
		unitName: "second",
		format: "HH:mm:ss",
		maxTimespan: 300, // up to 5 minutes
		alignmentUnit: "second",
		alignmentDivisor: 1,
		incrementAmount: 1,
		incrementUnit: "second",
	},
	{
		length: 60,
		label: "m",
		unitName: "minute",
		format: "HH:mm",
		maxTimespan: 3600, // up to 1 hour
		alignmentUnit: "minute",
		alignmentDivisor: 1,
		incrementAmount: 1,
		incrementUnit: "minute",
	},
	{
		length: 900,
		label: "15m",
		unitName: "minute",
		format: "HH:mm",
		maxTimespan: 28800, // up to 8 hours
		alignmentUnit: "hour",
		alignmentDivisor: 15,
		incrementAmount: 15,
		incrementUnit: "minute",
	},
	{
		length: 3600,
		label: "h",
		unitName: "hour",
		format: "HH:mm",
		maxTimespan: 129600, // up to 1.5 days (36 hours)
		alignmentUnit: "hour",
		alignmentDivisor: 1,
		incrementAmount: 1,
		incrementUnit: "hour",
	},
	{
		length: 86400,
		label: "d",
		unitName: "day",
		format: "MMM D",
		maxTimespan: 1209600, // up to 2 weeks (14 days)
		alignmentUnit: "day",
		alignmentDivisor: 1,
		incrementAmount: 1,
		incrementUnit: "day",
	},
	{
		length: 604800,
		label: "w",
		unitName: "week",
		format: "MMM D",
		maxTimespan: 23587200, // up to 9 months (273 days)
		alignmentUnit: "week",
		alignmentDivisor: 1,
		incrementAmount: 1,
		incrementUnit: "week",
	},
	{
		length: 2629746,
		label: "mo",
		unitName: "month",
		format: "MMM YYYY",
		maxTimespan: 315569520, // up to 10 years
		alignmentUnit: "month",
		alignmentDivisor: 1,
		incrementAmount: 1,
		incrementUnit: "month",
	},
	{
		length: 31556952,
		label: "y",
		unitName: "year",
		format: "YYYY",
		maxTimespan: Infinity, // everything above
		alignmentUnit: "year",
		alignmentDivisor: 1,
		incrementAmount: 1,
		incrementUnit: "year",
	},
];

const currentTimeUnit = computed((): TimeUnit => {
	return (
		timeUnits.find((unit) => currentTimespan.value <= unit.maxTimespan) ??
		timeUnits[timeUnits.length - 1]!
	);
});

const timelineMarks = computed<TimelineMark[]>(() => {
	const timeStart = currentTime.value.subtract(currentTimespan.value, "second");
	const timeEnd = currentTime.value;

	const currentUnitIndex = timeUnits.findIndex(
		(unit) => unit.length === currentTimeUnit.value.length,
	);
	const minorUnit: TimeUnit =
		currentUnitIndex > 0
			? timeUnits[currentUnitIndex - 1]!
			: currentTimeUnit.value;

	const createTimeSequence = (
		startTime: dayjs.Dayjs,
		endTime: dayjs.Dayjs,
		unit: TimeUnit,
	): dayjs.Dayjs[] => {
		const sequence: dayjs.Dayjs[] = [];
		const totalUnits = Math.ceil(currentTimespan.value / unit.length);
		// Generic alignment and increment handling
		let current: dayjs.Dayjs;

		if (unit.alignmentDivisor === 1) {
			// Standard alignment to unit boundary
			current = startTime.startOf(unit.alignmentUnit);
		} else {
			// Custom alignment (e.g., 15-minute boundaries within an hour)
			const alignmentStart = startTime.startOf(unit.alignmentUnit);
			const unitsPastAlignment = startTime.get(
				unit.alignmentUnit === "hour" ? "minute" : (unit.alignmentUnit as any),
			);
			const alignedUnits =
				Math.floor(unitsPastAlignment / unit.alignmentDivisor) *
				unit.alignmentDivisor;
			current = alignmentStart.set(
				unit.alignmentUnit === "hour" ? "minute" : (unit.alignmentUnit as any),
				alignedUnits,
			);
		}

		// If the aligned start is after our startTime, go back one increment
		if (current.isAfter(startTime)) {
			current = current.subtract(unit.incrementAmount, unit.incrementUnit);
		}

		// Generate sequence with proper increments
		for (let i = 0; i <= totalUnits + 2; i++) {
			sequence.push(current);
			current = current.add(unit.incrementAmount, unit.incrementUnit);
		}

		return sequence;
	};

	const timeToMark = (
		time: dayjs.Dayjs,
		isMajor: boolean,
		unit?: TimeUnit,
	): TimelineMark => ({
		y:
			SVG_HEIGHT -
			(time.diff(timeStart, "second") / currentTimespan.value) * SVG_HEIGHT,
		isMajor,
		time,
		...(isMajor && unit ? { label: formatTimeLabel(time, unit) } : {}),
	});

	// Filter to only include marks within visible range
	const majorSequence = createTimeSequence(
		timeStart,
		timeEnd,
		currentTimeUnit.value,
	).filter((time) => time.isAfter(timeStart) && time.isBefore(timeEnd));

	const minorSequence =
		minorUnit.length !== currentTimeUnit.value.length
			? createTimeSequence(timeStart, timeEnd, minorUnit).filter(
					(time) => time.isAfter(timeStart) && time.isBefore(timeEnd),
				)
			: [];

	const majorMarks = majorSequence.map((time) =>
		timeToMark(time, true, currentTimeUnit.value),
	);

	const minorMarks = minorSequence
		.map((time) => timeToMark(time, false))
		.filter(
			(mark) =>
				!majorMarks.some((majorMark) => Math.abs(majorMark.y - mark.y) < 2),
		);

	return [...majorMarks, ...minorMarks].sort((a, b) => a.y - b.y);
});

// Calculate visible videos box properties
const calculateVideosBox = (videos: Video[]) => {
	if (videos.length === 0) return null;

	const timeStart = currentTime.value.subtract(currentTimespan.value, "second");

	// Find earliest and latest video creation dates
	const videoDates = videos
		.map((video) => (video.createdAt ? dayjs(video.createdAt) : null))
		.filter((date): date is dayjs.Dayjs => date !== null);

	if (videoDates.length === 0) return null;

	const [earliestDate, latestDate] = videoDates.reduce(
		([earliest, latest], current) => [
			current.isBefore(earliest) ? current : earliest,
			current.isAfter(latest) ? current : latest,
		],
		[videoDates[0]!, videoDates[0]!],
	);

	// Convert to Y positions and clamp to SVG bounds
	const startY = Math.max(
		0,
		Math.min(
			SVG_HEIGHT -
				(earliestDate.diff(timeStart, "second") / currentTimespan.value) *
					SVG_HEIGHT,
			SVG_HEIGHT,
		),
	);
	const endY = Math.max(
		0,
		Math.min(
			SVG_HEIGHT -
				(latestDate.diff(timeStart, "second") / currentTimespan.value) *
					SVG_HEIGHT,
			SVG_HEIGHT,
		),
	);

	return {
		y: Math.min(startY, endY),
		height: Math.abs(endY - startY) || 10, // Minimum height of 10px
		x: 65, // Slightly to the left of long ticks (which start at x=68)
		width: 19, // Slightly wider than long ticks (which are 12px wide: 68-80)
	};
};

// Handle visible videos with debounced box calculation
const visibleVideosBox = ref<{
	x: number;
	y: number;
	width: number;
	height: number;
} | null>(null);

const handleVisibleVideosChange = useDebounceFn((videos: Video[]) => {
	visibleVideosBox.value = calculateVideosBox(videos);
}, 150);

function formatTimeLabel(date: dayjs.Dayjs, unit: TimeUnit): string {
	return date.format(unit.format);
}

function calculateNewTimespan(
	deltaY: number,
	ctrlKey: boolean,
	metaKey: boolean,
): number {
	const scaleFactor = ctrlKey || metaKey ? BASE_SCALE * 1.5 : BASE_SCALE;
	let newTimespan = currentTimespan.value;

	if (deltaY > 0) {
		// Scroll down - zoom out (increase timespan)
		newTimespan = Math.min(newTimespan * scaleFactor, MAX_TIMESPAN);
	} else {
		// Scroll up - zoom in (decrease timespan)
		newTimespan = Math.max(newTimespan / scaleFactor, MIN_TIMESPAN);
	}

	// Smart rounding based on timespan size
	if (newTimespan < 3600) {
		// Under 1 hour - round to nearest 30 seconds
		return Math.round(newTimespan / 30) * 30;
	} else if (newTimespan < 86400) {
		// Under 1 day - round to nearest 5 minutes
		return Math.round(newTimespan / 300) * 300;
	} else if (newTimespan < 604800) {
		// Under 1 week - round to nearest hour
		return Math.round(newTimespan / 3600) * 3600;
	} else {
		// Over 1 week - round to nearest day
		return Math.round(newTimespan / 86400) * 86400;
	}
}

useEventListener(
	svgElement,
	"wheel",
	useThrottleFn((event: WheelEvent): void => {
		event.preventDefault();
		event.stopPropagation();

		const newTimespan = calculateNewTimespan(
			event.deltaY,
			event.ctrlKey,
			event.metaKey,
		);

		currentTimespan.value = newTimespan;
	}, THROTTLE_DELAY),
	{ passive: false },
);

// Update current time periodically (commented out for demo purposes)
onMounted(() => {
	// const interval = setInterval(() => {
	// 	currentTime.value = dayjs();
	// }, 1000);
	//
	// onUnmounted(() => {
	// 	clearInterval(interval);
	// });
});
</script>
