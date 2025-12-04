<template>
	<div class="rounded-lg sm:px-6">
		<div v-if="!videos.length" class="text-center py-8">
			<div class="i-mdi-video-outline text-4xl mb-2" />
			<p class="text-primary-3">No videos found.</p>
		</div>

		<div v-else class="overflow-x-auto">
			<table ref="tableContainer" class="w-full border-collapse">
				<thead class="sticky top-0 bg-bg-color z-10">
					<tr class="border-b border-primary-2">
						<th class="text-left p-3 font-medium text-primary-4">Video</th>
						<th class="text-left p-3 font-medium text-primary-4">Duration</th>
						<th class="text-left p-3 font-medium text-primary-4">Released</th>
						<th class="text-left p-3 font-medium text-primary-4">Tags</th>
						<th class="text-left p-3 font-medium text-primary-4">Platforms</th>
						<th class="text-left p-3 font-medium text-primary-4">Added</th>
					</tr>
				</thead>
				<tbody>
					<!-- Top spacer for non-visible items above viewport -->
					<tr v-if="topSpacerHeight > 0">
						<td :colspan="6" :style="{ height: topSpacerHeight + 'px' }" />
					</tr>

					<!-- Visible items -->
					<VideoListItem
						v-for="item in visibleItems"
						:key="item.data.id"
						:video="item.data"
						:is-highlighted="highlightVideoId === item.data.id"
						@play="$emit('play', $event)"
					/>

					<!-- Bottom spacer for non-visible items below viewport -->
					<tr v-if="bottomSpacerHeight > 0">
						<td :colspan="6" :style="{ height: bottomSpacerHeight + 'px' }" />
					</tr>
				</tbody>
			</table>
		</div>
	</div>
</template>

<script setup lang="ts">
import {
	useWindowScroll,
	useWindowSize,
	useElementBounding,
	refThrottled,
} from "@vueuse/core";
import type { Video } from "~/types";

interface VirtualItem {
	index: number;
	data: Video;
}

const props = withDefaults(
	defineProps<{
		videos?: Video[];
		highlightVideoId?: string;
		itemHeight?: number;
		topPadding?: number;
		overscan?: number;
	}>(),
	{
		videos: () => [],
		highlightVideoId: "",
		itemHeight: 100, // Approximate height per row in pixels
		topPadding: 0, // Top padding offset (e.g., for fixed headers)
		overscan: 5, // Number of items to render outside viewport for smooth scrolling
	},
);

const emit = defineEmits<{
	play: [video: Video];
	visibleVideosChange: [videos: Video[]];
}>();

// Virtual scrolling setup using window/document scroll
const tableContainer = ref<HTMLElement>();
const { y: windowScrollY } = useWindowScroll();
const { height: windowHeight } = useWindowSize();
const { top: tableTop } = useElementBounding(tableContainer);

// Throttle scroll updates for better performance
const throttledScrollY = refThrottled(windowScrollY, 16); // ~60fps

// Calculate the visible range based on window scroll and table position
const visibleRange = computed(() => {
	if (!tableContainer.value || props.videos.length === 0) {
		return { startIndex: 0, endIndex: -1 };
	}

	const itemHeight = props.itemHeight;
	const windowScroll = throttledScrollY.value;
	const tableTopPosition = tableTop.value;
	const viewportHeight = windowHeight.value;

	// Simple calculation: how much of the table has been scrolled past
	// When tableTopPosition is negative, the table has scrolled past the top
	const scrolledPastTable =
		tableTopPosition >= 0
			? Math.max(0, windowScroll - tableTopPosition)
			: windowScroll;

	// Account for table header (sticky header is about 60px)
	const scrolledPastContent = Math.max(0, scrolledPastTable - 60);

	// Calculate which items should be visible
	const startIndex = Math.max(
		0,
		Math.floor(scrolledPastContent / itemHeight) - props.overscan,
	);
	const visibleItemCount =
		Math.ceil(viewportHeight / itemHeight) + props.overscan * 2;
	const endIndex = Math.min(
		props.videos.length - 1,
		startIndex + visibleItemCount,
	);

	return { startIndex, endIndex };
});

// Create virtual items for visible range
const visibleItems = computed((): VirtualItem[] => {
	const { startIndex, endIndex } = visibleRange.value;

	return props.videos
		.slice(startIndex, endIndex + 1)
		.map((video, i) => ({ index: startIndex + i, video }))
		.filter(
			(item): item is { index: number; video: Video } =>
				item.video !== undefined,
		)
		.map(({ index, video }) => ({
			index,
			data: video,
		}));
});

// Calculate spacer heights
const topSpacerHeight = computed(() => {
	return visibleRange.value.startIndex * props.itemHeight;
});

const bottomSpacerHeight = computed(() => {
	const { endIndex } = visibleRange.value;
	const remainingItems = props.videos.length - 1 - endIndex;
	return Math.max(0, remainingItems * props.itemHeight);
});

// Helper function to compare arrays
const arraysEqual = (a: string[], b: string[]): boolean => {
	if (a.length !== b.length) return false;
	return a.every((id, index) => id === b[index]);
};
// Track previous visible videos for change detection
let previousVisibleVideoIds: string[] = [];
// Emit visible videos when they change
watch(
	visibleItems,
	(newItems) => {
		const newVisibleVideoIds = newItems.map((item) => item.data.id);

		// Only emit if the visible videos actually changed
		if (!arraysEqual(previousVisibleVideoIds, newVisibleVideoIds)) {
			previousVisibleVideoIds = newVisibleVideoIds;
			const visibleVideos = newItems.map((item) => item.data);
			emit("visibleVideosChange", visibleVideos);
		}
	},
	{ immediate: true, deep: true },
);

// Watch for highlighted video changes and scroll to it if needed
// watch(
// 	() => props.highlightVideoId,
// 	(newId) => {
// 		if (newId && tableContainer.value) {
// 			const videoIndex = props.videos.findIndex((video) => video.id === newId);
// 			if (videoIndex !== -1) {
// 				const targetScrollTop =
// 					tableTop.value + videoIndex * props.itemHeight + props.topPadding;
// 				const currentScrollTop = windowScrollY.value;
// 				const viewportHeight = windowHeight.value;

// 				// Only scroll if the item is not already visible
// 				if (
// 					targetScrollTop < currentScrollTop ||
// 					targetScrollTop > currentScrollTop + viewportHeight - props.itemHeight
// 				) {
// 					window.scrollTo({
// 						top: Math.max(0, targetScrollTop - props.itemHeight),
// 						behavior: "smooth",
// 					});
// 				}
// 			}
// 		}
// 	},
// );
</script>
