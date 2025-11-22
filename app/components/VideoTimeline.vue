<template>
	<div
		class="fixed inset-0 h-screen flex flex-col justify-center pl-3 w-24"
		@wheel.prevent.stop
	>
		<!-- Current date (top) -->
		<div class="text-xs text-primary-3 text-center mb-1">
			{{ currentTime.format("YYYY MMM D") }}
		</div>

		<div class="relative group max-h-90%">
			<svg
				ref="svgElement"
				class="h-full"
				width="85"
				viewBox="0 0 85 800"
				xmlns="http://www.w3.org/2000/svg"
			>
				<!-- Timeline marks -->
				<g v-for="mark in timelineMarks" :key="mark.id">
					<!-- Major unit marks (longer dashes) -->
					<rect
						v-if="mark.isMajor"
						:x="68"
						:y="mark.y - 1"
						width="12"
						height="2"
						fill="currentColor"
						class="text-primary-4 transition-all duration-300 ease-in-out"
					/>
					<!-- Minor unit marks (shorter dashes) -->
					<rect
						v-else
						:x="72"
						:y="mark.y - 0.5"
						width="8"
						height="1"
						fill="currentColor"
						class="text-primary-3 transition-all duration-300 ease-in-out"
					/>
					<!-- Time labels for major marks -->
					<text
						v-if="mark.isMajor && mark.label"
						:x="60"
						:y="mark.y + 4"
						:class="{
							'opacity-0': isTimelineTransitioning,
							'opacity-100': !isTimelineTransitioning,
						}"
						class="text-xs fill-primary-3 transition-opacity duration-500 ease-in-out"
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
					class="fill-accent stroke-accent stroke-2 transition-all duration-300 ease-in-out"
					fill-opacity="0.3"
					stroke-opacity="1"
					rx="4"
					ry="4"
				/>
			</svg>

			<!-- Scroll Indicator Overlay -->
			<div
				class="group-hover:flex hidden absolute inset-0 flex-col items-center justify-center pointer-events-none transition-opacity duration-200"
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
		<VideoList
			:videos="videos"
			:highlight-video-id="props.highlightVideoId"
			@play="emit('play', $event)"
			@visible-videos-change="handleVisibleVideosChange"
		/>
	</div>
</template>

<script setup lang="ts">
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import relativeTime from "dayjs/plugin/relativeTime";
import customParseFormat from "dayjs/plugin/customParseFormat";
import duration from "dayjs/plugin/duration";
import { useEventListener, useThrottleFn } from "@vueuse/core";
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
	id: string;
}

const SVG_HEIGHT = 800;
const MIN_TIMESPAN = 1800; // 30 minutes minimum
const MAX_TIMESPAN = 157784760; // 5 years maximum
const BASE_SCALE = 1.15;
const THROTTLE_DELAY = 50;
const TIMELINE_CENTER = SVG_HEIGHT / 2;

const currentTimespan = ref<number>(1728000); // 20 days
const currentTime = ref<dayjs.Dayjs>(dayjs());
const svgElement = ref<SVGElement>();
const isTimelineTransitioning = ref<boolean>(false);

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

		// Generate sequence with buffer for smooth animation (extra marks above and below)
		const bufferUnits = 5;
		for (let i = 0; i <= totalUnits + 2 + bufferUnits; i++) {
			sequence.push(current);
			current = current.add(unit.incrementAmount, unit.incrementUnit);
		}

		return sequence;
	};

	const timeToMark = (
		time: dayjs.Dayjs,
		isMajor: boolean,
		unit?: TimeUnit,
	): TimelineMark => {
		// Create stable ID based on the exact mark time to avoid duplicates
		const timeKey = time.format("YYYY-MM-DD-HH-mm-ss");
		const markUnit = unit || currentTimeUnit.value;

		return {
			y:
				SVG_HEIGHT -
				(time.diff(timeStart, "second") / currentTimespan.value) * SVG_HEIGHT,
			isMajor,
			time,
			id: `${timeKey}-${markUnit.label}-${isMajor ? "major" : "minor"}`,
			...(isMajor && unit ? { label: formatTimeLabel(time, unit) } : {}),
		};
	};

	// Create extended time range for buffer marks
	const bufferTime = currentTimespan.value * 0.2; // 20% buffer
	const extendedTimeStart = timeStart.subtract(bufferTime, "second");
	const extendedTimeEnd = timeEnd.add(bufferTime, "second");

	// Generate marks with buffer for smooth animation
	const majorSequence = createTimeSequence(
		extendedTimeStart,
		extendedTimeEnd,
		currentTimeUnit.value,
	);

	const minorSequence =
		minorUnit.length !== currentTimeUnit.value.length
			? createTimeSequence(extendedTimeStart, extendedTimeEnd, minorUnit)
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

	// Filter out marks that are outside the visible range (with buffer for animation)
	const visibleMarks = [...majorMarks, ...minorMarks]
		.filter((mark) => mark.y >= -100 && mark.y <= SVG_HEIGHT + 100)
		.sort((a, b) => a.y - b.y);

	return visibleMarks;
});

// Reactive videos center time
const currentVisibleVideos = ref<Video[]>([]);

const videosCenterTime = computed(() => {
	const videos = currentVisibleVideos.value;
	if (videos.length === 0) return null;

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

	return {
		centerTime: earliestDate.add(
			latestDate.diff(earliestDate, "second") / 2,
			"second",
		),
		earliestDate,
		latestDate,
	};
});

// Calculate visible videos box properties relative to videosCenterTime position
const visibleVideosBox = computed(() => {
	const videosCenter = videosCenterTime.value;
	if (!videosCenter) return null;

	const { centerTime, earliestDate, latestDate } = videosCenter;

	// Calculate where the videos center time appears on the current timeline
	const timeStart = currentTime.value.subtract(currentTimespan.value, "second");
	const videosCenterY =
		SVG_HEIGHT -
		(centerTime.diff(timeStart, "second") / currentTimespan.value) * SVG_HEIGHT;

	// Calculate video timespan and box height
	const videoTimespan = latestDate.diff(earliestDate, "second");
	const boxHeight = Math.max(
		(videoTimespan / currentTimespan.value) * SVG_HEIGHT,
		10, // Minimum height of 10px
	);

	return {
		y: videosCenterY - boxHeight / 2, // Position relative to where videos actually are
		height: boxHeight,
		x: 65, // Slightly to the left of long ticks (which start at x=68)
		width: 19, // Slightly wider than long ticks (which are 12px wide: 68-80)
	};
});

const handleVisibleVideosChange = useThrottleFn((videos: Video[]) => {
	currentVisibleVideos.value = videos;

	// Check if we need to center the timeline on any change
	checkAndCenterTimeline();
}, 150);

function checkAndCenterTimeline() {
	const videosCenter = videosCenterTime.value;
	if (!videosCenter) return;

	const { centerTime } = videosCenter;

	// Calculate where this center time currently appears on the timeline
	const timeStart = currentTime.value.subtract(currentTimespan.value, "second");
	const currentVideosCenterY =
		SVG_HEIGHT -
		(centerTime.diff(timeStart, "second") / currentTimespan.value) * SVG_HEIGHT;

	// Check if videos center is significantly off from timeline center (threshold to avoid jitter)
	const threshold = 50; // pixels - increased threshold for better stability
	const pixelDifference = currentVideosCenterY - TIMELINE_CENTER;

	if (Math.abs(pixelDifference) > threshold) {
		// Calculate the new currentTime needed to position the videos center at timeline center
		const newCurrentTime = centerTime.add(currentTimespan.value / 2, "second");

		// Ensure we don't go into the future
		const maxTime = dayjs();
		const clampedNewTime = newCurrentTime.isAfter(maxTime)
			? maxTime
			: newCurrentTime;

		// Trigger fade-out/fade-in animation for timeline position change
		animateTimelineTransition(clampedNewTime);
	}
}

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
	useThrottleFn(async (event: WheelEvent) => {
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

function animateTimelineTransition(newTime: dayjs.Dayjs): void {
	// Start fade-out
	isTimelineTransitioning.value = true;

	// After fade-out completes, update time and fade back in
	setTimeout(() => {
		currentTime.value = newTime;

		// Small delay to ensure DOM updates, then fade back in
		setTimeout(() => {
			isTimelineTransitioning.value = false;
		}, 500);
	}, 300); // Match the transition duration
}
</script>
