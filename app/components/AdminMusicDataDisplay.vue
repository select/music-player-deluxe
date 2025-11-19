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
		<div v-if="songData.lastfmTags?.length" class="mt-1 flex gap-1 flex-wrap">
			<span
				v-for="tag in songData.lastfmTags.slice(0, 3)"
				:key="`lastfm-${tag}`"
				class="inline-block bg-red-500/20 text-red-300 px-1 rounded text-xs"
				:title="`Last.fm tag: ${tag}`"
			>
				{{ tag }}
			</span>
		</div>
		<div
			v-if="songData.listeners || songData.playcount"
			class="mt-1 text-xs text-primary-3"
		>
			<span v-if="songData.listeners" class="mr-2">
				🎧 {{ songData.listeners.toLocaleString() }}
			</span>
			<span v-if="songData.playcount">
				▶️ {{ songData.playcount.toLocaleString() }}
			</span>
		</div>
		<div
			v-if="songData.odesli && Object.keys(songData.odesli).length > 0"
			class="mt-2 flex gap-2 flex-wrap items-center"
		>
			<span class="text-xs text-primary-3 mr-1">Listen on:</span>
			<a
				v-for="(id, platformId) in songData.odesli"
				:key="platformId"
				:href="getPlatformUrl(platformId, id)"
				target="_blank"
				rel="noopener noreferrer"
				class="text-primary-3 hover:text-accent transition-colors"
				:title="`Listen on ${getPlatformName(platformId)}`"
			>
				<div :class="getPlatformIcon(platformId)" class="text-sm" />
			</a>
		</div>
	</div>
</template>

<script setup lang="ts">
import type { SongMetaData } from "~/types";

interface Props {
	songData?: SongMetaData;
}

withDefaults(defineProps<Props>(), {
	songData: undefined,
});

// Admin view shows all available platforms
</script>
