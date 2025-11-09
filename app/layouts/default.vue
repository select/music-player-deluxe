<template>
	<div class="min-h-screen bg-bg-color" :class="{ 'pb-20': showPlayerBar }">
		<slot />

		<!-- Global Video Player Bar -->
		<VideoPlayerBar
			v-if="showPlayerBar"
			:current-video="currentVideo"
			:is-playing="isPlaying"
			:can-play-previous="canPlayPrevious"
			:can-play-next="canPlayNext"
			@toggle-play-pause="handleTogglePlayPause"
			@previous="handlePrevious"
			@next="handleNext"
			@close="handleClose"
		/>

		<!-- Floating Video Player -->
		<VideoPlayer
			:isOpen="isFloatingPlayerOpen"
			:playlist="playlist"
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

// Global player state
const {
	showPlayerBar,
	currentVideo,
	currentIndex,
	playlist,
	isPlaying,
	canPlayPrevious,
	canPlayNext,
	isFloatingPlayerOpen,
	previousVideo,
	nextVideo,
	closePlayer,
	closeFloatingPlayer,
} = useGlobalPlayer();

// Event handlers for VideoPlayerBar
const handleTogglePlayPause = (): void => {
	// This will be handled by the VideoPlayer component through global state
	// For now, we'll emit a custom event that the VideoPlayer can listen to
	const event = new CustomEvent("globalPlayerToggle");
	window.dispatchEvent(event);
};

const handlePrevious = (): void => {
	previousVideo();
	const event = new CustomEvent("globalPlayerPrevious");
	window.dispatchEvent(event);
};

const handleNext = (): void => {
	nextVideo();
	const event = new CustomEvent("globalPlayerNext");
	window.dispatchEvent(event);
};

const handleClose = (): void => {
	closePlayer();
	const event = new CustomEvent("globalPlayerClose");
	window.dispatchEvent(event);
};

// Event handlers for VideoPlayer
const handleFloatingPlayerClose = (): void => {
	closeFloatingPlayer();
};

const handleVideoChange = (video: Video, index: number): void => {
	// Video change is already handled by global state
	// This handler is kept for potential future use
};
</script>
