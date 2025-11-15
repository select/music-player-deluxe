<template>
	<div class="pt-24">
		<!-- Loading State -->
		<div v-if="loading" class="flex items-center justify-center py-12">
			<div class="flex items-center gap-3 text-primary-3">
				<div class="i-mdi-loading animate-spin text-2xl" />
				<span>Loading playlist...</span>
			</div>
		</div>

		<!-- Error State -->
		<div
			v-else-if="error"
			class="bg-primary-1 border border-primary-2 rounded-lg p-6 m-8"
		>
			<div class="flex items-center gap-2 text-primary-3">
				<div class="i-mdi-alert-circle" />
				<strong>Error:</strong> {{ error }}
			</div>
		</div>

		<!-- No Playlists State -->
		<div v-else-if="!hasCurrentPlaylist" class="text-center py-12">
			<div class="i-mdi-playlist-remove text-6xl text-primary-3 mb-4" />
			<h3 class="text-xl font-semibold mb-2">No Playlists Found</h3>
			<p class="text-primary-3 mb-6">
				No cached playlists are available. Use the admin panel to fetch
				playlists from YouTube.
			</p>
		</div>

		<!-- Search and Video Grid/List -->
		<div v-else class="flex flex-col gap-12 pt-6 pb-12">
			<VideoSearch />
			<VideoGrid
				v-if="viewMode === 'grid'"
				:videos="currentVideos"
				:highlight-video-id="currentlyPlayingVideoId"
				@play="handleVideoClick"
			/>
			<VideoList
				v-else
				:videos="currentVideos"
				:highlight-video-id="currentlyPlayingVideoId"
				@play="handleVideoClick"
			/>
		</div>
	</div>
</template>

<script setup lang="ts">
import type { Video } from "../types";

// Page metadata
useHead({
	title: "Music Playlist View",
	meta: [
		{ name: "description", content: "Browse your cached YouTube playlists" },
	],
});

// Stores
const { loadFirstPlaylist, findVideoIndex } = usePlaylistStore();
const { currentPlaylist, currentVideos, loading, error, hasCurrentPlaylist } =
	storeToRefs(usePlaylistStore());
const { viewMode } = storeToRefs(useUserSettingsStore());
const globalPlayer = useGlobalPlayer();

// Reactive data
const currentlyPlayingVideoId = ref<string>("");

// Load first playlist on mount
onMounted(async () => {
	await loadFirstPlaylist();
});

// Handle video click to start playing
const handleVideoClick = (video: Video): void => {
	if (!currentPlaylist.value) return;

	// Find the video index in the current playlist videos
	const videoIndex = findVideoIndex(video.id);
	if (videoIndex === -1) return;

	// Set currently playing video ID for highlighting
	currentlyPlayingVideoId.value = video.id;

	// Initialize global player state (this will open the floating player)
	globalPlayer.initializeGlobalPlayer(videoIndex);
};

// Watch for video changes from global player to update highlighting
watch([globalPlayer.currentVideo], ([video]) => {
	if (video) {
		currentlyPlayingVideoId.value = video.id;
	} else {
		currentlyPlayingVideoId.value = "";
	}
});
</script>
