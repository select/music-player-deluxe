<template>
	<div class="min-h-screen bg-bg-color" :class="{ 'pb-20': showPlayerBar }">
		<slot />

		<!-- Global Video Player Bar -->
		<VideoPlayerBar v-if="showPlayerBar" />

		<!-- Floating Video Player -->
		<VideoPlayer
			:is-open="isFloatingPlayerOpen"
			:initial-video-index="currentIndex"
			@close="handleFloatingPlayerClose"
			@video-change="handleVideoChange"
		/>
	</div>
</template>

<script setup lang="ts">
// UnoCSS reset is now included internally in Wind4 preset

// Global keyboard shortcuts are handled automatically by the store

// Global player state
const { showPlayerBar, isFloatingPlayerOpen, currentIndex } =
	storeToRefs(usePlayerStore());
const { closeFloatingPlayer } = usePlayerStore();

// Event handlers for VideoPlayer
const handleFloatingPlayerClose = (): void => {
	closeFloatingPlayer();
};

const handleVideoChange = (): void => {
	// Video change is already handled by global state
	// This handler is kept for potential future use
};
</script>
