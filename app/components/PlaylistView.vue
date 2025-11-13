<template>
	<div class="max-h-60 overflow-y-auto border border-primary-2 rounded-lg">
		<div
			class="p-2 bg-primary-2 text-primary-4 text-sm font-medium border-b border-primary-2"
		>
			Playlist ({{ playlist.length }} videos)
		</div>
		<div
			v-for="(video, index) in playlist"
			:key="video.id"
			:class="[
				'flex items-center p-2 cursor-pointer hover:bg-primary-2 transition-colors',
				index === currentIndex && 'bg-accent bg-opacity-20',
			]"
			@click="playVideo(index)"
		>
			<img
				:src="video.thumbnail"
				:alt="video.title"
				class="w-12 h-9 object-cover rounded mr-3 flex-shrink-0"
			/>
			<div class="flex-1 min-w-0">
				<p
					:class="[
						'text-sm font-medium truncate',
						index === currentIndex ? 'text-accent' : 'text-primary-4',
					]"
				>
					{{ video.title }}
				</p>
				<p class="text-xs text-primary-3 truncate">{{ video.channel }}</p>
			</div>
			<div class="text-xs text-primary-3 ml-2 flex-shrink-0">
				{{ video.duration }}
			</div>
			<div
				v-if="index === currentIndex"
				class="i-mdi-volume-high w-4 h-4 text-accent ml-2 flex-shrink-0"
			/>
		</div>
	</div>
</template>

<script setup lang="ts">
// Use global player and playlist store
const { currentIndex, playVideo } = useGlobalPlayer();
const { currentVideos: playlist } = storeToRefs(usePlaylistStore());
</script>
