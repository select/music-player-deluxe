<template>
	<div
		v-if="currentVideo"
		class="fixed bottom-0 left-1/2 transform -translate-x-1/2 z-40 bg-primary-1 p-4 rounded-xl mb-3"
	>
		<div
			class="w-full sm:w-md md:w-2xl lg:w-3xl mx-auto flex items-center gap-4"
		>
			<!-- Video Thumbnail -->
			<img
				:src="`https://i.ytimg.com/vi/${currentVideo.id}/hqdefault.jpg`"
				:alt="currentVideo.title"
				class="w-12 h-9 object-cover rounded flex-shrink-0"
			>

			<!-- Video Info -->
			<div class="flex-1 min-w-0">
				<h3 class="text-primary-4 font-medium text-sm line-clamp-1">
					{{ currentVideo.title }}
				</h3>
				<p class="text-primary-3 text-xs line-clamp-1">
					{{ currentVideo.channel }}
				</p>
			</div>

			<!-- Controls -->
			<div class="flex items-center gap-2">
				<AppBtn
					variant="secondary"
					:disabled="!canPlayPrevious"
					class="!p-2"
					@click="previousVideo"
				>
					<div class="i-mdi-skip-previous w-4 h-4" />
				</AppBtn>

				<AppBtn variant="primary" class="!p-2" @click="togglePlayPause">
					<div v-if="isPlaying" class="i-mdi-pause w-5 h-5" />
					<div v-else class="i-mdi-play w-5 h-5" />
				</AppBtn>

				<AppBtn
					variant="secondary"
					:disabled="!canPlayNext"
					class="!p-2"
					@click="nextVideo"
				>
					<div class="i-mdi-skip-next w-4 h-4" />
				</AppBtn>
			</div>

			<!-- Duration -->
			<div class="text-primary-3 text-xs flex-shrink-0 hidden sm:block">
				{{ currentVideo.duration }}
			</div>

			<!-- Close Button -->
			<AppBtn variant="ghost" class="!p-2" @click="closePlayer">
				<div class="i-mdi-close text-xl" />
			</AppBtn>
		</div>
	</div>
</template>

<script setup lang="ts">
// Use global player store
const { currentVideo, isPlaying, canPlayPrevious, canPlayNext } =
	storeToRefs(usePlayerStore());

const { togglePlayPause, previousVideo, nextVideo, closePlayer } =
	usePlayerStore();
</script>
