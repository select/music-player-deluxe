<template>
	<div v-if="songData" class="p-2 rounded text-xs">
		<div class="font-medium text-primary-4 line-clamp-1">
			{{ songData.title }}
		</div>
		<div class="text-primary-3 line-clamp-1">by {{ songData.artist }}</div>
		<div v-if="songData.album" class="text-primary-3 line-clamp-1">
			{{ songData.album }}
		</div>
		<div
			v-if="
				songData.tags?.length ||
				songData.genres?.length ||
				songData.artistTags?.length
			"
			class="mt-1 flex gap-2 flex-wrap"
		>
			<span
				v-for="tag in songData.tags?.slice(0, 3) || []"
				:key="`song-${tag}`"
				class="inline-block bg-accent/20 text-black px-1 rounded text-xs mr-1"
			>
				{{ tag }}
			</span>
			<span
				v-for="genre in songData.genres?.slice(0, 3) || []"
				:key="`genre-${genre}`"
				class="inline-block bg-primary-3/30 text-primary-4 px-1 rounded text-xs mr-1"
				:title="`Genre: ${genre}`"
			>
				{{ genre }}
			</span>
			<span
				v-for="tag in songData.artistTags?.slice(0, 2) || []"
				:key="`artist-${tag}`"
				class="inline-block bg-primary-2/60 text-primary-4 px-1 rounded text-xs mr-1"
				:title="`Artist tag: ${tag}`"
			>
				{{ tag }}
			</span>
		</div>
	</div>
</template>

<script setup lang="ts">
import type { MusicBrainzSongData } from "~/types";

interface Props {
	songData?: MusicBrainzSongData;
}

withDefaults(defineProps<Props>(), {
	songData: undefined,
});
</script>
