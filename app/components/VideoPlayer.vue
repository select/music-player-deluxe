<template>
	<div
		v-if="isOpen"
		class="fixed top-1/2 right-4 z-50 w-full max-w-xs -translate-y-1/2"
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
		playlist?: Video[];
		initialVideoIndex?: number;
	}>(),
	{
		isOpen: false,
		playlist: () => [],
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
	playlist,
	canPlayPrevious,
	canPlayNext,
	setCurrentVideo,
	setIsPlaying,
	setIsPlayerReady,
	setPlaylist,
	setCurrentIndex,
	previousVideo,
	nextVideo,
	playVideo,
	closePlayer: closeGlobalPlayer,
	initializeGlobalPlayer,
} = useGlobalPlayer();

// Player container ref and YouTube player instance
const playerContainer = ref<HTMLElement>();
let player: any = null;

// Watch for prop changes to initialize global state
watch(
	[() => props.playlist, () => props.initialVideoIndex],
	([newPlaylist, newIndex]) => {
		if (newPlaylist && newPlaylist.length > 0) {
			setPlaylist(newPlaylist);
			if (newIndex !== undefined) {
				setCurrentIndex(newIndex);
			}
		}
	},
	{ immediate: true },
);

watch(
	() => props.isOpen,
	(isOpen) => {
		if (isOpen) {
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

// Watch for modal open to initialize global state
watch(
	() => props.isOpen,
	(isOpen) => {
		if (isOpen && playlist.value.length > 0) {
			initializeGlobalPlayer(playlist.value, currentIndex.value);
		}
	},
);

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
	}
};

// Control functions
const closePlayer = (): void => {
	closeGlobalPlayer();
	emit("close");
};

const togglePlayPause = (): void => {
	if (!player || !isPlayerReady.value) return;

	if (isPlaying.value) {
		player.pauseVideo();
	} else {
		player.playVideo();
	}
};

const handlePrevious = (): void => {
	previousVideo();
};

const handleNext = (): void => {
	nextVideo();
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
			handlePrevious();
			break;
		case "ArrowRight":
			event.preventDefault();
			handleNext();
			break;
	}
};

// Global event listeners for player bar controls
const handleGlobalPlayerToggle = (): void => {
	if (props.isOpen) {
		togglePlayPause();
	}
};

const handleGlobalPlayerPrevious = (): void => {
	if (props.isOpen) {
		handlePrevious();
	}
};

const handleGlobalPlayerNext = (): void => {
	if (props.isOpen) {
		handleNext();
	}
};

const handleGlobalPlayerClose = (): void => {
	if (props.isOpen) {
		closePlayer();
	}
};

// Lifecycle hooks
onMounted(() => {
	document.addEventListener("keydown", handleKeydown);
	window.addEventListener("globalPlayerToggle", handleGlobalPlayerToggle);
	window.addEventListener("globalPlayerPrevious", handleGlobalPlayerPrevious);
	window.addEventListener("globalPlayerNext", handleGlobalPlayerNext);
	window.addEventListener("globalPlayerClose", handleGlobalPlayerClose);
});

onUnmounted(() => {
	document.removeEventListener("keydown", handleKeydown);
	window.removeEventListener("globalPlayerToggle", handleGlobalPlayerToggle);
	window.removeEventListener(
		"globalPlayerPrevious",
		handleGlobalPlayerPrevious,
	);
	window.removeEventListener("globalPlayerNext", handleGlobalPlayerNext);
	window.removeEventListener("globalPlayerClose", handleGlobalPlayerClose);
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
