<template>
	<div class="rounded-lg shadow-sm">
		<div class="flex items-center justify-between mb-4">
			<h3 class="text-lg font-semibold flex items-center gap-2">
				<div class="i-mdi-playlist-music" />
				Video List ({{ videos.length }} videos)
			</h3>
		</div>

		<div v-if="!videos.length" class="text-center py-8">
			<div class="i-mdi-video-outline text-4xl mb-2" />
			<p class="">No videos found in this playlist.</p>
		</div>

		<div v-else class="overflow-x-auto">
			<table class="w-full border-collapse">
				<thead>
					<tr class="border-b border-primary-2">
						<th class="text-left p-3 font-medium text-primary-4">Video</th>
						<th class="text-left p-3 font-medium text-primary-4">Channel</th>
						<th class="text-left p-3 font-medium text-primary-4">Duration</th>
						<th class="text-left p-3 font-medium text-primary-4">Music Data</th>
						<th class="text-left p-3 font-medium text-primary-4">Actions</th>
					</tr>
				</thead>
				<tbody>
					<template v-for="video in videos" :key="video.id">
						<tr
							class="border-b border-primary-2/30 hover:bg-bg-gradient transition-colors"
						>
							<!-- Video Info Column -->
							<td class="p-3">
								<div class="flex items-center gap-3">
									<div class="flex-shrink-0">
										<img
											:src="`https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`"
											:alt="video.title"
											class="w-12 h-12 rounded-full object-cover bg-primary-1"
										>
									</div>
									<div class="flex-1 min-w-0">
										<h4 class="font-medium text-primary-4 line-clamp-2 text-sm">
											{{ video.title }}
										</h4>
										<a
											:href="`https://www.youtube.com/watch?v=${video.id}`"
											target="_blank"
											rel="noopener noreferrer"
											class="text-xs text-primary-3 hover:text-accent transition-colors"
										>
											Watch on YouTube
										</a>
									</div>
								</div>
							</td>

							<!-- Channel Column -->
							<td class="p-3">
								<span class="text-sm text-primary-3">{{ video.channel }}</span>
							</td>

							<!-- Duration Column -->
							<td class="p-3">
								<span class="text-sm text-primary-3 font-mono">{{
									video.duration
								}}</span>
							</td>

							<!-- Music Data Column -->
							<td class="p-3">
								<div class="min-w-48">
									<!-- Existing Music Data -->
									<AdminMusicDataDisplay :song-data="songDataMap[video.id]" />

									<!-- No Data State -->
									<div
										v-if="
											!songDataMap[video.id] &&
											!searchResultsMap[video.id]?.length &&
											!parsedTitlesMap[video.id]?.length
										"
										class="text-xs text-primary-3"
									/>
								</div>
							</td>

							<!-- Actions Column -->
							<td class="p-3">
								<div class="flex flex-wrap items-center gap-2">
									<AppBtn
										v-if="
											!songDataMap[video.id] &&
											!parsedTitlesMap[video.id]?.length
										"
										icon="i-mdi-text-search"
										size="small"
										variant="ghost"
										@click="showParsedTitles(video)"
									>
										Search
									</AppBtn>

									<AppBtn
										v-if="
											songDataMap[video.id] &&
											!songDataMap[video.id]?.artistTags?.length &&
											!songDataMap[video.id]?.tags?.length
										"
										icon="i-mdi-tag-plus"
										size="small"
										variant="ghost"
										:disabled="loadingStates[video.id]"
										@click="fetchArtistTags(video.id)"
									>
										Add Artist Tags
									</AppBtn>

									<AppBtn
										v-if="songDataMap[video.id]"
										icon="i-mdi-delete"
										size="small"
										variant="ghost"
										@click="clearMusicData(video.id)"
									>
										Clear
									</AppBtn>
								</div>
							</td>
						</tr>

						<!-- Search Form Row (Full Width) -->
						<tr
							v-if="
								parsedTitlesMap[video.id]?.length ||
								searchResultsMap[video.id]?.length
							"
							class="border-b border-primary-2/30"
						>
							<td colspan="5" class="p-3 space-y-4">
								<!-- Search Form (Parsed Titles) -->
								<AdminSearchForm
									v-if="parsedTitlesMap[video.id]?.length"
									:video-id="video.id"
									:parsed-titles="parsedTitlesMap[video.id]"
									@search-complete="
										(results) => handleSearchComplete(video.id, results)
									"
									@search-error="(error) => handleSearchError(error)"
									@cancel="clearParsedTitles(video.id)"
								/>

								<!-- Search Results Selection -->
								<AdminSearchResultsSelection
									v-if="searchResultsMap[video.id]?.length"
									:video-id="video.id"
									:search-results="searchResultsMap[video.id]"
									@match-complete="
										(songData) => handleMatchComplete(video.id, songData)
									"
									@match-error="(error) => handleMatchError(error)"
									@cancel="clearSearchResults(video.id)"
								/>
							</td>
						</tr>
					</template>
				</tbody>
			</table>
		</div>
	</div>
</template>

<script setup lang="ts">
import type {
	Video,
	MusicBrainzSearchResult,
	MusicBrainzSongData,
	ApiResponse,
	ParsedTitle,
} from "~/types";

interface Props {
	videos?: Video[];
}

const props = withDefaults(defineProps<Props>(), {
	videos: () => [],
});

// Reactive state
const songDataMap = ref<Record<string, MusicBrainzSongData>>({});
const searchResultsMap = ref<Record<string, MusicBrainzSearchResult[]>>({});
const parsedTitlesMap = ref<Record<string, ParsedTitle[]>>({});
const loadingStates = ref<Record<string, boolean>>({});

// Load existing song data for all videos
const loadExistingSongData = async (): Promise<void> => {
	for (const video of props.videos) {
		try {
			const response = await $fetch<ApiResponse<MusicBrainzSongData>>(
				`/api/songs/${video.id}`,
			);
			if (response.success && response.data) {
				songDataMap.value[video.id] = response.data;
			}
		} catch {
			// No existing data, that's fine
		}
	}
};

// Load existing song data on mount and when videos change
watchEffect(async () => {
	await loadExistingSongData();
});

// Handle match completion from SearchResultsSelection
const handleMatchComplete = (
	videoId: string,
	songData: MusicBrainzSongData,
): void => {
	songDataMap.value[videoId] = songData;
	delete searchResultsMap.value[videoId]; // Clear search results
	delete parsedTitlesMap.value[videoId]; // Clear parsed titles
};

// Handle match errors from SearchResultsSelection
const handleMatchError = (error: string): void => {
	console.error("Match error:", error);
	// You can add notification handling here
};

// Handle search completion from AdminSearchForm
const handleSearchComplete = (
	videoId: string,
	results: MusicBrainzSearchResult[],
): void => {
	searchResultsMap.value[videoId] = results;
};

// Handle search errors from AdminSearchForm
const handleSearchError = (error: string): void => {
	console.error("Search error:", error);
	// You can add notification handling here
};

// Clear search results for a video
const clearSearchResults = (videoId: string): void => {
	delete searchResultsMap.value[videoId];
	delete parsedTitlesMap.value[videoId]; // Clear parsed titles
};

// Show parsed titles for a video
const showParsedTitles = (video: Video): void => {
	const parsedTitles = parseArtistAndTitle(video.title);

	// If no parsing results or only low-confidence fallback, enhance with channel info
	if (
		parsedTitles.length === 0 ||
		(parsedTitles.length === 1 &&
			parsedTitles[0] &&
			parsedTitles[0].confidence <= 0.1)
	) {
		const channelArtist = extractArtistFromChannel(video.channel);

		// Replace or add a better fallback using channel as artist
		const fallbackResult = {
			artist: channelArtist || "Unknown Artist",
			title: video.title,
			confidence: 0.2, // Slightly higher confidence when we have channel info
		};

		if (parsedTitles.length === 0) {
			parsedTitles.push(fallbackResult);
		} else {
			// Replace the low-confidence fallback with channel-enhanced version
			parsedTitles[0] = fallbackResult;
		}
	}

	parsedTitlesMap.value[video.id] = parsedTitles;
};

// Clear parsed titles for a video
const clearParsedTitles = (videoId: string): void => {
	delete parsedTitlesMap.value[videoId];
};

// Clear music data for a video
const clearMusicData = (videoId: string): void => {
	delete songDataMap.value[videoId];
	delete searchResultsMap.value[videoId];
	delete parsedTitlesMap.value[videoId];
	// You might want to also delete the file from server here
	// by calling a DELETE endpoint
};

// Fetch artist tags for a video
const fetchArtistTags = async (videoId: string): Promise<void> => {
	try {
		loadingStates.value[videoId] = true;

		const response = await $fetch<ApiResponse<MusicBrainzSongData>>(
			"/api/musicbrainz/artist-tags",
			{
				method: "POST",
				body: { youtubeId: videoId },
			},
		);

		if (response.success && response.data) {
			songDataMap.value[videoId] = response.data;
		}
	} catch (error) {
		console.error("Error fetching artist tags:", error);
		// You can add notification handling here
	} finally {
		delete loadingStates.value[videoId];
	}
};
</script>
