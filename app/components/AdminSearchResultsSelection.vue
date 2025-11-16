<template>
	<div v-if="searchResults?.length" class="space-y-2">
		<div class="text-xs font-medium text-primary-4 mb-2">
			Select best match:
		</div>
		<div
			v-for="result in searchResults.slice(0, 3)"
			:key="result.id"
			class="bg-primary-2 p-2 rounded cursor-pointer hover:bg-primary-3/20 transition-colors"
			:class="{ 'opacity-50 pointer-events-none': isMatching }"
			@click="handleSelectResult(result.id)"
		>
			<div class="text-xs font-medium text-primary-4 line-clamp-1">
				{{ result.title }}
			</div>
			<div class="text-xs text-primary-3 line-clamp-1">
				by {{ result.artist }}
			</div>
			<div class="flex justify-between items-center mt-1">
				<span class="text-xs text-primary-3">
					{{ result.releaseCount }} release{{
						result.releaseCount !== 1 ? "s" : ""
					}}
				</span>
				<span class="text-xs text-accent">{{ result.score }}%</span>
			</div>
		</div>
		<AppBtn
			v-if="isMatching"
			size="small"
			variant="ghost"
			disabled
			class="text-xs"
		>
			Matching...
		</AppBtn>
		<AppBtn
			v-else
			size="small"
			variant="ghost"
			class="text-xs"
			@click="handleCancel"
		>
			Cancel
		</AppBtn>
	</div>
</template>

<script setup lang="ts">
import type {
	MusicBrainzSearchResult,
	SongMetaData,
	MusicBrainzMatchRequest,
	MusicBrainzResponse,
} from "~/types";

interface Props {
	videoId: string;
	searchResults?: MusicBrainzSearchResult[];
}

interface Emits {
	matchComplete: [songData: SongMetaData];
	matchError: [error: string];
	cancel: [];
}

const props = withDefaults(defineProps<Props>(), {
	searchResults: undefined,
});

const emit = defineEmits<Emits>();

const isMatching = ref(false);

// Match a video to a selected MusicBrainz recording
const handleSelectResult = async (selectedMbid: string): Promise<void> => {
	isMatching.value = true;

	try {
		const response = await $fetch<MusicBrainzResponse>(
			"/api/musicbrainz/match",
			{
				method: "POST",
				body: {
					videoId: props.videoId,
					selectedMbid,
				} as MusicBrainzMatchRequest,
			},
		);

		if (response.success && response.data) {
			emit("matchComplete", response.data);
		} else {
			emit("matchError", "Failed to match recording");
		}
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : "Unknown error occurred";
		emit("matchError", `Error matching recording: ${errorMessage}`);
	} finally {
		isMatching.value = false;
	}
};

const handleCancel = (): void => {
	emit("cancel");
};
</script>
