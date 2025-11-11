<template>
	<div>
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
		<div v-else-if="!firstPlaylist" class="text-center py-12">
			<div class="i-mdi-playlist-remove text-6xl text-primary-3 mb-4" />
			<h3 class="text-xl font-semibold mb-2">No Playlists Found</h3>
			<p class="text-primary-3 mb-6">
				No cached playlists are available. Use the admin panel to fetch
				playlists from YouTube.
			</p>
		</div>

		<!-- Search and Video Grid -->
		<div v-else class="flex flex-col gap-12 pt-6 pb-12">
			<VideoSearch
				:videos="firstPlaylist.videos"
				@filtered-videos="handleFilteredVideos"
			/>
			<VideoGrid
				:videos="displayVideos"
				:highlight-video-id="currentlyPlayingVideoId"
				@play="handleVideoClick"
			/>
		</div>
	</div>
</template>

<script setup lang="ts">
import type { Video, Playlist, IndexResponse } from "../types";

// Page metadata
useHead({
	title: "Music Playlist View",
	meta: [
		{ name: "description", content: "Browse your cached YouTube playlists" },
	],
});

// Reactive data
const firstPlaylist = ref<Playlist | null>(null);
const loading = ref<boolean>(true);
const error = ref<string>("");
const displayVideos = ref<Video[]>([]);

// Global player state
const globalPlayer = useGlobalPlayer();
const currentlyPlayingVideoId = ref<string>("");

// Load first playlist on mount
onMounted(async () => {
	await loadFirstPlaylist();
});

// Load first playlist from index and its videos
const loadFirstPlaylist = async (): Promise<void> => {
	try {
		loading.value = true;
		error.value = "";

		// Load index to get first playlist info
		const indexResponse = await $fetch<IndexResponse>("/index.json");

		if (!indexResponse.success || !indexResponse.data.length) {
			firstPlaylist.value = null;
			return;
		}

		// Get the first playlist from index
		const firstPlaylistInfo = indexResponse.data[0];

		// Load the full playlist data with videos
		const playlistResponse = await $fetch<Playlist>(
			`/playlist/${firstPlaylistInfo?.fileName}`,
		);

		firstPlaylist.value = playlistResponse;
		// Sort videos by createdAt (latest first), fallback to original order for videos without createdAt
		const sortedVideos = [...playlistResponse.videos].sort((a, b) => {
			// Videos with createdAt come first
			if (a.createdAt && !b.createdAt) return -1;
			if (!a.createdAt && b.createdAt) return 1;

			// Both have createdAt, sort by latest first
			if (a.createdAt && b.createdAt) {
				return b.createdAt - a.createdAt;
			}

			// Neither have createdAt, maintain original order
			return 0;
		});
		displayVideos.value = sortedVideos;
	} catch (err: any) {
		console.error("Error loading first playlist:", err);
		error.value = err.data?.message || err.message || "Failed to load playlist";
	} finally {
		loading.value = false;
	}
};

// Handle filtered videos from search component
const handleFilteredVideos = (videos: Video[]): void => {
	displayVideos.value = videos;
};

// Handle video click to start playing
const handleVideoClick = (video: Video): void => {
	if (!firstPlaylist.value) return;

	// Find the video index in the original playlist (not the filtered display)
	const videoIndex = firstPlaylist.value.videos.findIndex(
		(v) => v.id === video.id,
	);
	if (videoIndex === -1) return;

	// Set currently playing video ID for highlighting
	currentlyPlayingVideoId.value = video.id;

	// Initialize global player state (this will open the floating player)
	globalPlayer.initializeGlobalPlayer(firstPlaylist.value.videos, videoIndex);
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
