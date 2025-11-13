<template>
	<div class="min-h-screen bg-bg-color" :class="{ 'pb-20': showPlayerBar }">
		<slot />

		<!-- Global Video Player Bar -->
		<VideoPlayerBar v-if="showPlayerBar" />

		<!-- Floating Video Player -->
		<VideoPlayer
			:isOpen="isFloatingPlayerOpen"
			:initialVideoIndex="currentIndex"
			@close="handleFloatingPlayerClose"
			@videoChange="handleVideoChange"
		/>
	</div>
</template>

<script setup lang="ts">
// Import UnoCSS Tailwind reset
import "@unocss/reset/tailwind.css";
import type { Video } from "~/types";

// Global keyboard shortcuts are handled automatically by the store

// Global player state
const {
	showPlayerBar,
	currentVideo,
	currentIndex,
	isPlaying,
	canPlayPrevious,
	canPlayNext,
	isFloatingPlayerOpen,
	previousVideo,
	nextVideo,
	closePlayer,
	closeFloatingPlayer,
} = useGlobalPlayer();

// Event handlers for VideoPlayer
const handleFloatingPlayerClose = (): void => {
	closeFloatingPlayer();
};

const handleVideoChange = (video: Video, index: number): void => {
	// Video change is already handled by global state
	// This handler is kept for potential future use
};
</script>
