<template>
	<div
		class="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(240px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4 sm:gap-6 px-6"
	>
		<div
			v-for="video in videos"
			:key="video.id"
			ref="videoElements"
			class="relative group shadow-black hover:shadow-md hover:bg-zinc-900 flex flex-col gap-3 rounded-2xl hover:rounded-b-0 pa-2 transition-shadow duration-200"
			:class="{
				'outline-accent outline-2 outline-solid outline-bottom-0':
					highlightVideoId === video.id,
			}"
		>
			<!-- Video Thumbnail -->
			<div
				class="rounded-2xl overflow-hidden w-full aspect-video relative cursor-pointer"
				@click="$emit('play', video)"
			>
				<!-- Play Overlay -->
				<div
					class="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
				>
					<div class="i-mdi-play-outline text-accent text-8xl" />
				</div>
				<!-- Currently Playing Indicator -->
				<div
					v-if="highlightVideoId === video.id"
					class="absolute top-2 right-2 bg-accent text-black px-2 py-1 rounded text-xs font-medium flex items-center gap-1"
				>
					<div class="i-mdi-volume-high w-3 h-3" />
					Playing
				</div>
				<img
					:src="`https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`"
					:alt="video.title"
					class="w-full h-full object-cover"
					loading="lazy"
				/>
			</div>

			<!-- Video Info -->
			<div class="flex flex-col gap-1">
				<!-- Artist -->
				<div v-if="video.artist" class="text-gray-5 text-sm font-medium">
					{{ video.artist }}
				</div>

				<!-- Title -->
				<div class="leading-5 text-primary-3 line-clamp-2">
					{{ video.musicTitle || video.title }}
				</div>
			</div>

			<!-- Hover Overlay -->
			<div
				class="hidden group-hover:flex absolute bg-zinc-900 w-full top-full left-0 flex-col z-10 shadow-black shadow-md rounded-b-2xl p-3"
				:class="{
					'outline-2 outline-solid outline-accent ':
						highlightVideoId === video.id,
				}"
			>
				<!-- Channel and Duration -->
				<div class="flex items-center justify-between gap-3 mb-2">
					<p class="text-gray-400 text-xs sm:text-sm">
						{{ video.channel }}
					</p>
					<div class="flex flex-col items-end gap-1">
						<p
							class="text-gray-500 text-xs sm:text-sm flex items-center justify-center gap-1"
						>
							<span class="i-mdi-clock-outline text-xs" />
							{{ video.duration }}
						</p>
						<div
							v-if="video.releasedAt || video.artistCountry"
							class="flex items-center gap-1 text-xs"
						>
							<span
								class="inline-block w-4"
								:title="
									video.artistCountry
										? `Artist from ${video.artistCountry}`
										: ''
								"
							>
								{{
									video.artistCountry ? getFlagEmoji(video.artistCountry) : ""
								}}
							</span>
							<span
								v-if="video.releasedAt"
								class="text-gray-500"
								:title="formatReleaseDate(video.releasedAt)"
							>
								{{ video.releasedAt.split("-")[0] }}
							</span>
						</div>
					</div>
				</div>

				<!-- User and Created Date -->
				<div class="flex items-center justify-between gap-3 mb-2">
					<div class="flex items-center gap-2">
						<div
							class="w-4 h-4 rounded-full flex items-center justify-center text-white text-xs font-bold"
							:style="{ backgroundColor: getUserColor(video.userId || ' ') }"
						>
							<span class="i-mdi-account text-xs" />
						</div>
					</div>
					<p v-if="video.createdAt" class="text-gray-500 text-xs sm:text-sm">
						{{ formatDate(video.createdAt) }}
					</p>
				</div>

				<!-- Tags -->
				<div v-if="video.tags && video.tags.length > 0" class="pt-2">
					<div class="flex flex-wrap gap-1">
						<span
							v-for="tag in video.tags"
							:key="tag"
							class="text-xs b-1 b-solid b-accent-2 text-accent px-2 py-1 rounded-lg"
						>
							{{ tag }}
						</span>
					</div>
				</div>

				<!-- Platform Links -->
				<div
					v-if="
						video.externalIds &&
						selectedPlatformIds.some((id) => video.externalIds?.[id])
					"
					class="pt-2"
				>
					<div class="flex items-center gap-2">
						<span class="text-xs text-primary-3">Listen on:</span>
						<a
							v-for="platformId in selectedPlatformIds.filter(
								(id) => video.externalIds?.[id],
							)"
							:key="platformId"
							:href="getPlatformUrl(platformId, video.externalIds[platformId]!)"
							target="_blank"
							rel="noopener noreferrer"
							class="text-primary-3 hover:text-accent transition-colors"
							:title="`Listen on ${getPlatformName(platformId)}`"
						>
							<div :class="getPlatformIcon(platformId)" class="text-xl" />
						</a>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { useIntersectionObserver, useDebounceFn } from "@vueuse/core";
import type { Video } from "../types";

const props = withDefaults(
	defineProps<{
		videos?: Video[];
		highlightVideoId?: string;
	}>(),
	{
		videos: () => [],
		highlightVideoId: undefined,
	},
);

// Emit visible videos when they change
const emit = defineEmits<{
	play: [video: Video];
	visibleVideosChange: [videos: Video[]];
}>();

// Template refs for video elements
const videoElements = ref<HTMLElement[]>([]);

// Track visible videos with single reactive variable
const visibleVideos = ref<Video[]>([]);

// Map to track visibility state by video ID
const visibilityStates = reactive(new Map<string, boolean>());

// Debounced emit function for better performance
const debouncedEmit = useDebounceFn((videos: Video[]) => {
	emit("visibleVideosChange", videos);
}, 150);

// Single intersection observer for all video elements
const { stop } = useIntersectionObserver(
	videoElements,
	(entries) => {
		// Update visibility states for changed entries only
		entries.forEach((entry) => {
			const index = videoElements.value.indexOf(entry.target as HTMLElement);
			if (index !== -1 && props.videos[index]) {
				const video = props.videos[index];
				visibilityStates.set(video.id, entry.isIntersecting);
			}
		});

		// Rebuild visible videos from current visibility states
		const newVisibleVideos = props.videos.filter(
			(video) => visibilityStates.get(video.id) || false,
		);

		// Only emit if the visible videos actually changed
		if (!arraysEqual(visibleVideos.value, newVisibleVideos)) {
			visibleVideos.value = newVisibleVideos;
			debouncedEmit(newVisibleVideos);
		}
	},
	{
		threshold: 0.1,
		rootMargin: "50px",
	},
);

// Helper function to compare arrays
const arraysEqual = (a: Video[], b: Video[]): boolean => {
	if (a.length !== b.length) return false;
	return a.every((video, index) => video.id === b[index]?.id);
};

// Clean up visibility states when videos change
watch(
	() => props.videos,
	() => {
		// Clear stale visibility states
		const currentVideoIds = new Set(props.videos.map((v) => v.id));
		for (const [videoId] of visibilityStates) {
			if (!currentVideoIds.has(videoId)) {
				visibilityStates.delete(videoId);
			}
		}
	},
	{ deep: true },
);

// Clean up on unmount
onUnmounted(() => {
	stop();
});

// Get selected platforms from user settings
const { settings } = storeToRefs(useUserSettingsStore());
const selectedPlatformIds = computed(
	() => settings.value.selectedPlatforms || [],
);

dayjs.extend(relativeTime);
// Format timestamp to readable date using dayjs
const formatDate = (timestamp: number): string => {
	return dayjs(timestamp).fromNow();
};

// Format release date (YYYY-MM-DD or YYYY-MM or YYYY)
const formatReleaseDate = (date: string): string => {
	if (!date) return "";
	const parts = date.split("-");
	if (parts.length === 1) return parts[0]; // Just year
	if (parts.length === 2) return dayjs(`${date}-01`).format("MMM YYYY"); // Year and month
	return dayjs(date).format("MMM D, YYYY"); // Full date
};

// Convert country code to flag emoji
const getFlagEmoji = (countryCode: string): string => {
	if (!countryCode || countryCode.length !== 2) return "";
	const codePoints = countryCode
		.toUpperCase()
		.split("")
		.map((char) => 127397 + char.charCodeAt(0));
	return String.fromCodePoint(...codePoints);
};
</script>
