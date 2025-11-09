<template>
	<AppBtn
		v-if="!hasMusicData && !hasSearchResults"
		icon="i-mdi-music-note"
		size="small"
		variant="ghost"
		:disabled="isLoading"
		@click="handleSearch"
	>
		{{ isLoading ? "Searching..." : "Search" }}
	</AppBtn>
</template>

<script setup lang="ts">
import type {
	Video,
	MusicBrainzSearchResult,
	SearchRequest,
	SearchResponse,
} from "~/types";

interface Props {
	video: Video;
	hasMusicData?: boolean;
	hasSearchResults?: boolean;
}

interface Emits {
	searchComplete: [results: MusicBrainzSearchResult[]];
	searchError: [error: string];
}

const props = withDefaults(defineProps<Props>(), {
	hasMusicData: false,
	hasSearchResults: false,
});

const emit = defineEmits<Emits>();

const isLoading = ref(false);

// Search MusicBrainz for the video
const handleSearch = async (): Promise<void> => {
	isLoading.value = true;

	try {
		const response = await $fetch<SearchResponse>("/api/musicbrainz/search", {
			method: "POST",
			body: { video: props.video } as SearchRequest,
		});

		if (response.success && response.results.length > 0) {
			emit("searchComplete", response.results);
		} else {
			emit("searchError", `No MusicBrainz matches found for: ${props.video.title}`);
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
		emit("searchError", `Error searching MusicBrainz: ${errorMessage}`);
	} finally {
		isLoading.value = false;
	}
};
</script>
