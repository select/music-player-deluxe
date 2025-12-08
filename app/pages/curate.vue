<template>
	<div class="container mx-auto px-4 py-8 max-w-4xl">
		<div class="flex items-center justify-between mb-8">
			<h1 class="text-3xl font-bold flex items-center gap-3">
				<div class="i-mdi-music-note-plus" />
				Curate Music Data
			</h1>
			<AppBtn icon="i-mdi-arrow-left" variant="primary" to="/">
				Back to Playlists
			</AppBtn>
		</div>

		<!-- Loading State -->
		<div v-if="loading" class="flex items-center justify-center py-12">
			<div class="flex items-center gap-3 text-primary-3">
				<div class="i-mdi-loading animate-spin text-2xl" />
				<span>Loading random song...</span>
			</div>
		</div>

		<!-- Error State -->
		<div
			v-else-if="error"
			class="bg-primary-1 border border-error rounded-lg p-6"
		>
			<div class="flex items-center gap-2 text-error mb-4">
				<div class="i-mdi-alert-circle" />
				<strong>Error:</strong> {{ error }}
			</div>
			<AppBtn variant="primary" @click="loadRandomSong"> Try Again </AppBtn>
		</div>

		<!-- No Songs Found -->
		<div
			v-else-if="!currentSong"
			class="bg-primary-1 rounded-lg p-8 text-center"
		>
			<div class="i-mdi-music-note-off text-6xl text-primary-3 mb-4" />
			<h2 class="text-xl font-semibold text-primary-4 mb-2">
				No Songs Need Curation
			</h2>
			<p class="text-primary-3 mb-4">
				All songs in the playlist have been curated or have metadata!
			</p>
			<AppBtn variant="primary" to="/"> Back to Playlists </AppBtn>
		</div>

		<!-- Curation Interface -->
		<div v-else class="space-y-6">
			<!-- Curation Component -->
			<div class="bg-bg-gradient rounded-lg p-6">
				<CurationInterface
					:song="currentSong"
					:channel="currentChannel"
					@cancel="() => loadRandomSong(true)"
					@success="handleCurationSuccess"
				/>
			</div>
			<!-- Stats -->
			<div class="bg-primary-1 rounded-lg p-4">
				<div class="flex items-center justify-between">
					<div class="text-sm text-primary-3">
						Songs curated this session:
						<span class="text-accent font-semibold">{{ curatedCount }}</span>
					</div>
				</div>
			</div>
			<!-- Song Info Card -->
			<div class="bg-bg-gradient rounded-lg p-6">
				<h2 class="text-xl font-semibold mb-4 flex items-center gap-2">
					<div class="i-mdi-music" />
					Current Song
				</h2>

				<!-- YouTube Embed -->
				<div class="mb-6 aspect-video rounded-lg overflow-hidden bg-black">
					<iframe
						:src="`https://www.youtube.com/embed/${currentSong.youtubeId}`"
						class="w-full h-full"
						frameborder="0"
						allow="
							accelerometer;
							autoplay;
							clipboard-write;
							encrypted-media;
							gyroscope;
							picture-in-picture;
						"
						allowfullscreen
					/>
				</div>

				<!-- Metadata Info -->
				<div class="grid grid-cols-1 md:grid-cols-3 gap-3">
					<div class="bg-primary-1 rounded-lg p-3 text-center">
						<div class="text-xs text-primary-3 mb-1">External IDs</div>
						<div
							class="text-lg font-semibold"
							:class="hasExternalIds ? 'text-accent' : 'text-error'"
						>
							{{ hasExternalIds ? "Yes" : "No" }}
						</div>
					</div>
					<div class="bg-primary-1 rounded-lg p-3 text-center">
						<div class="text-xs text-primary-3 mb-1">AI Data</div>
						<div
							class="text-lg font-semibold"
							:class="hasAiData ? 'text-accent' : 'text-error'"
						>
							{{ hasAiData ? "Yes" : "No" }}
						</div>
					</div>
					<div class="bg-primary-1 rounded-lg p-3 text-center">
						<div class="text-xs text-primary-3 mb-1">Last.fm Data</div>
						<div
							class="text-lg font-semibold"
							:class="hasLastfmData ? 'text-accent' : 'text-error'"
						>
							{{ hasLastfmData ? "Yes" : "No" }}
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import type { Video, SongMetaData } from "~/types";
import { useSessionStorage } from "@vueuse/core";

useHead({
	title: "Curate Music Data - Music Playlist View",
	meta: [{ name: "description", content: "Curate and improve music metadata" }],
});

const loading = ref(true);
const error = ref<string>("");
const currentSong = ref<SongMetaData | null>(null);
const currentChannel = ref<string>("");

// Store curated and skipped songs in session storage (persists during browser session)
const curatedSongs = useSessionStorage<string[]>("curated-songs", []);
const skippedSongs = useSessionStorage<string[]>("skipped-songs", []);
const curatedCount = computed(() => curatedSongs.value.length);

const hasExternalIds = computed(() => {
	if (!currentSong.value) return false;
	return !!(
		currentSong.value.odesli ||
		currentSong.value.musicbrainz?.externalIdsTrack ||
		currentSong.value.musicbrainz?.externalIdsArtist
	);
});

const hasAiData = computed(() => {
	if (!currentSong.value) return false;
	return !!(currentSong.value.ai?.artist && currentSong.value.ai?.title);
});

const hasLastfmData = computed(() => {
	if (!currentSong.value) return false;
	return !!currentSong.value.lastfm?.id;
});

const loadRandomSong = async (skipCurrent = false) => {
	try {
		// If skipping current song, add it to skipped list
		if (skipCurrent && currentSong.value?.youtubeId) {
			if (!skippedSongs.value.includes(currentSong.value.youtubeId)) {
				skippedSongs.value.push(currentSong.value.youtubeId);
			}
		}

		loading.value = true;
		error.value = "";

		// Load playlist
		const playlistData = await $fetch<any>(
			"/playlist/PLHh-DPsAXiAUVUVA9DpRtiYRrwgvqg8Fx.json",
		);
		const videos: Video[] = playlistData.videos || [];

		// Load all song metadata
		const allSongs = await $fetch<Record<string, SongMetaData>>(
			"/api/metadata/all",
			{
				method: "POST",
			},
		);

		// Filter songs that need curation
		const needsCuration = videos.filter((video) => {
			const songData = allSongs[video.id];

			// Skip if already curated in this session
			if (curatedSongs.value.includes(video.id)) return false;

			// Skip if already skipped in this session
			if (skippedSongs.value.includes(video.id)) return false;

			// Skip if already curated in file
			if (songData?.curated) return false;

			// Include if missing external IDs, AI data, or Last.fm data
			const hasExternalIds = !!(
				songData?.odesli ||
				songData?.musicbrainz?.externalIdsTrack ||
				songData?.musicbrainz?.externalIdsArtist
			);
			const hasLastfmData = !!songData?.lastfm?.id;

			return !hasExternalIds && !hasLastfmData;
		});

		if (needsCuration.length === 0) {
			currentSong.value = null;
			return;
		}

		// Pick a random song
		const randomVideo =
			needsCuration[Math.floor(Math.random() * needsCuration.length)];
		const songData = allSongs[randomVideo.id];

		// Store channel name
		currentChannel.value = randomVideo.channel;

		// Merge video and song data
		currentSong.value = {
			youtubeId: randomVideo.id,
			title: randomVideo.title,
			musicTitle: randomVideo.musicTitle,
			artist: randomVideo.artist,
			lastFetched: new Date().toISOString(),
			...songData,
		};
	} catch (err: any) {
		console.error("Error loading random song:", err);
		error.value = "Failed to load songs for curation";
	} finally {
		loading.value = false;
	}
};

const handleCurationSuccess = (artist: string, title: string) => {
	// Add current song to curated list (stored in session storage)
	if (currentSong.value?.youtubeId) {
		if (!curatedSongs.value.includes(currentSong.value.youtubeId)) {
			curatedSongs.value.push(currentSong.value.youtubeId);
		}
	}

	// Show success message
	console.log(`Successfully curated: ${artist} - ${title}`);

	// Load next song
	loadRandomSong();
};

// Load initial song
onMounted(() => {
	loadRandomSong();
});
</script>
