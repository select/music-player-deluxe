<template>
	<div
		v-if="isOpen"
		class="fixed top-20 sm:top-1/2 left-1/2 sm:left-auto right-auto sm:right-4 z-50 w-full max-w-xs -translate-x-1/2 sm:translate-x-0 sm:-translate-y-1/2"
	>
		<div class="bg-primary-1 rounded-2xl shadow-xl overflow-hidden">
			<!-- Header -->
			<div class="absolute top-2 right-2">
				<AppBtn variant="ghost" @click="closePlayer" class="!p-2">
					<div class="i-mdi-close w-5 h-5" />
				</AppBtn>
			</div>

			<!-- Player Container -->
			<div class="p-4">
				<div class="aspect-video bg-black rounded-2xl overflow-hidden">
					<div
						ref="playerContainer"
						id="youtube-player"
						class="w-full h-full"
					/>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import type { Video } from "~/types";

// Props
const props = withDefaults(
	defineProps<{
		isOpen?: boolean;
		initialVideoIndex?: number;
	}>(),
	{
		isOpen: false,
		initialVideoIndex: 0,
	},
);

// Emits
const emit = defineEmits<{
	close: [];
	videoChange: [video: Video, index: number];
}>();

// Global player state
const {
	currentVideo,
	currentIndex,
	isPlaying,
	isPlayerReady,
	canPlayNext,
	setIsPlaying,
	setIsPlayerReady,
	setCurrentIndex,
	setYouTubePlayerInstance,
	togglePlayPause,
	previousVideo,
	nextVideo,
	closePlayer: closeGlobalPlayer,
	initializeGlobalPlayer,
} = useGlobalPlayer();

// Playlist store
const { currentVideos: playlist } = storeToRefs(usePlaylistStore());

// Player container ref and YouTube player instance
const playerContainer = ref<HTMLElement>();
let player: any = null;

// Watch for prop changes to initialize global state
watch(
	() => props.initialVideoIndex,
	(newIndex) => {
		if (newIndex !== undefined) {
			setCurrentIndex(newIndex);
		}
	},
	{ immediate: true },
);

watch(
	() => props.isOpen,
	(isOpen) => {
		if (isOpen) {
			if (playlist.value.length > 0) {
				initializeGlobalPlayer(currentIndex.value);
			}
			nextTick(() => {
				initializePlayer();
			});
		} else {
			destroyPlayer();
		}
	},
);

// Watch for video changes from global state to load new video and emit to parent
watch([currentVideo, currentIndex], ([video, index]) => {
	if (video) {
		loadVideo();
		emit("videoChange", video, index);
	}
});

// YouTube API functions
const initializePlayer = (): void => {
	if (!process.client || !currentVideo.value) return;

	// Check if YouTube API is already loaded
	if (window.YT && window.YT.Player) {
		createPlayer();
	} else {
		// Load YouTube API if not already loaded
		if (!window.onYouTubeIframeAPIReady) {
			const tag = document.createElement("script");
			tag.src = "https://www.youtube.com/iframe_api";
			const firstScriptTag = document.getElementsByTagName("script")[0];
			if (firstScriptTag && firstScriptTag.parentNode) {
				firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
			} else {
				document.head.appendChild(tag);
			}

			window.onYouTubeIframeAPIReady = () => {
				createPlayer();
			};
		}
	}
};

const createPlayer = (): void => {
	if (!playerContainer.value || !currentVideo.value) return;

	// Clear any existing player
	destroyPlayer();

	player = new window.YT.Player("youtube-player", {
		height: "100%",
		width: "100%",
		videoId: currentVideo.value.id,
		playerVars: {
			autoplay: 1,
			controls: 1,
			modestbranding: 1,
			rel: 0,
			showinfo: 0,
		},
		events: {
			onReady: onPlayerReady,
			onStateChange: onPlayerStateChange,
		},
	});
};

const onPlayerReady = (): void => {
	setIsPlayerReady(true);
	setIsPlaying(true);
	// Register the YouTube player instance with global player
	setYouTubePlayerInstance(player);
};

const onPlayerStateChange = (event: any): void => {
	const state = event.data;

	// YouTube player states
	const YT_ENDED = 0;
	const YT_PLAYING = 1;
	const YT_PAUSED = 2;

	switch (state) {
		case YT_PLAYING:
			setIsPlaying(true);
			break;
		case YT_PAUSED:
			setIsPlaying(false);
			break;
		case YT_ENDED:
			setIsPlaying(false);
			// Auto-play next video
			if (canPlayNext.value) {
				nextVideo();
			}
			break;
	}
};

const loadVideo = (): void => {
	if (!player || !isPlayerReady.value || !currentVideo.value) return;

	player.loadVideoById(currentVideo.value.id);
};

const destroyPlayer = (): void => {
	if (player && typeof player.destroy === "function") {
		player.destroy();
		player = null;
		setIsPlayerReady(false);
		setYouTubePlayerInstance(null);
	}
};

// Control functions
const closePlayer = (): void => {
	closeGlobalPlayer();
	emit("close");
};

// Keyboard controls
const handleKeydown = (event: KeyboardEvent): void => {
	if (!props.isOpen) return;

	switch (event.code) {
		case "Escape":
			closePlayer();
			break;
		case "Space":
			event.preventDefault();
			togglePlayPause();
			break;
		case "ArrowLeft":
			event.preventDefault();
			previousVideo();
			break;
		case "ArrowRight":
			event.preventDefault();
			nextVideo();
			break;
	}
};

// Lifecycle hooks
onMounted(() => {
	document.addEventListener("keydown", handleKeydown);
});

onUnmounted(() => {
	document.removeEventListener("keydown", handleKeydown);
	destroyPlayer();
});

// Global type declaration for YouTube API
declare global {
	interface Window {
		YT: any;
		onYouTubeIframeAPIReady: () => void;
	}
}
</script>
