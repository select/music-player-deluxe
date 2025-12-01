<template>
	<div
		v-if="isOpen"
		ref="playerWrapper"
		:style="{
			position: 'fixed',
			left: `${playerPosition.x}px`,
			top: `${playerPosition.y}px`,
			width: `${playerPosition.width}px`,
			height: `${playerPosition.height}px`,
			zIndex: 50,
			minWidth: '280px',
			minHeight: '200px',
			maxWidth: '800px',
			maxHeight: '600px',
		}"
		class="select-none group"
	>
		<!-- Circular drag handle above player -->
		<div class="hidden group-hover:flex absolute -top-6 right-3 gap-1">
			<div
				ref="dragHandle"
				class="w-8 h-8 bg-primary-1 rounded-t-2xl shadow-lg flex items-center justify-center cursor-move"
				@mousedown="startDragging"
			>
				<div class="i-mdi-drag w-4 h-4 text-primary-3" />
			</div>
			<!-- Header -->
			<div
				class="w-8 h-8 bg-primary-1 rounded-t-2xl shadow-xl flex items-center justify-center"
			>
				<AppBtn variant="ghost" class="!p-2" @click="closePlayer">
					<div class="i-mdi-close w-5 h-5" />
				</AppBtn>
			</div>
		</div>

		<div class="bg-primary-1 rounded-2xl shadow-xl overflow-hidden h-full">
			<!-- Player Container -->
			<div class="p-4 h-full">
				<div class="bg-black rounded-2xl overflow-hidden h-full">
					<div
						id="youtube-player"
						ref="playerContainer"
						class="w-full h-full"
					/>
				</div>
			</div>

			<!-- Resize handles -->
			<!-- Bottom-right resize handle -->
			<div
				ref="resizeHandle"
				class="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
				@mousedown="startResizing"
			>
				<div
					class="i-mdi-resize-bottom-right w-4 h-4 text-primary-3 opacity-50 hover:opacity-100"
				/>
			</div>

			<!-- Bottom-left resize handle -->
			<div
				ref="resizeHandleLeft"
				class="absolute bottom-0 left-0 w-4 h-4 cursor-sw-resize"
				@mousedown="startResizingLeft"
			>
				<div
					class="i-mdi-resize-bottom-right w-4 h-4 text-primary-3 opacity-50 hover:opacity-100 transform scale-x-[-1]"
				/>
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

// Global player store
const { currentVideo, currentIndex, isPlayerReady, canPlayNext } =
	storeToRefs(usePlayerStore());

const {
	setIsPlaying,
	setIsPlayerReady,
	setCurrentIndex,
	setYouTubePlayerInstance,
	togglePlayPause,
	previousVideo,
	nextVideo,
	closePlayer: closeGlobalPlayer,
	initializeGlobalPlayer,
} = usePlayerStore();

// Playlist store
const { currentVideos: playlist } = storeToRefs(usePlaylistStore());

// User settings store for position/size persistence
const { videoPlayerPosition } = storeToRefs(useUserSettingsStore());
const { updateMediaSessionMetadata, updateMediaSessionPlaybackState } =
	useUserSettingsStore();

// Player container ref and YouTube player instance
const playerContainer = ref<HTMLElement>();
const playerWrapper = ref<HTMLElement>();
const dragHandle = ref<HTMLElement>();
const resizeHandle = ref<HTMLElement>();
const resizeHandleLeft = ref<HTMLElement>();
let player: any = null;

// Reactive position and size
const playerPosition = ref({
	x: videoPlayerPosition.value.x,
	y: videoPlayerPosition.value.y,
	width: videoPlayerPosition.value.width,
	height: videoPlayerPosition.value.height,
});

// Dragging state
const isDragging = ref(false);
const isResizing = ref(false);
const isResizingLeft = ref(false);
const dragOffset = ref({ x: 0, y: 0 });
const resizeStart = ref({ x: 0, y: 0, width: 0, height: 0 });

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
		// Update Media Session metadata when video changes
		updateMediaSessionMetadata(video);
	}
});

// YouTube API functions
const initializePlayer = (): void => {
	if (!import.meta.client || !currentVideo.value) return;

	// Check if YouTube API is already loaded
	if ((window as any).YT && (window as any).YT.Player) {
		createPlayer();
	} else {
		// Load YouTube API if not already loaded
		if (!(window as any).onYouTubeIframeAPIReady) {
			const tag = document.createElement("script");
			tag.src = "https://www.youtube.com/iframe_api";
			const firstScriptTag = document.getElementsByTagName("script")[0];
			if (firstScriptTag && firstScriptTag.parentNode) {
				firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
			} else {
				document.head.appendChild(tag);
			}

			(window as any).onYouTubeIframeAPIReady = () => {
				createPlayer();
			};
		}
	}
};

const createPlayer = (): void => {
	if (!playerContainer.value || !currentVideo.value) return;

	// Clear any existing player
	destroyPlayer();

	player = new (window as any).YT.Player("youtube-player", {
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
	// Update Media Session playback state
	updateMediaSessionPlaybackState("playing");
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
			updateMediaSessionPlaybackState("playing");
			break;
		case YT_PAUSED:
			setIsPlaying(false);
			updateMediaSessionPlaybackState("paused");
			break;
		case YT_ENDED:
			setIsPlaying(false);
			updateMediaSessionPlaybackState("none");
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
		updateMediaSessionPlaybackState("none");
	}
};

// Dragging functionality
const startDragging = (event: MouseEvent): void => {
	if (!playerWrapper.value) return;

	isDragging.value = true;
	const rect = playerWrapper.value.getBoundingClientRect();
	dragOffset.value = {
		x: event.clientX - rect.left,
		y: event.clientY - rect.top,
	};

	document.addEventListener("mousemove", handleDrag);
	document.addEventListener("mouseup", stopDragging);
	event.preventDefault();
};

const handleDrag = (event: MouseEvent): void => {
	if (!isDragging.value) return;

	const newX = event.clientX - dragOffset.value.x;
	const newY = event.clientY - dragOffset.value.y;

	// Keep within viewport bounds
	const maxX = window.innerWidth - playerPosition.value.width;
	const maxY = window.innerHeight - playerPosition.value.height;

	playerPosition.value.x = Math.max(0, Math.min(newX, maxX));
	playerPosition.value.y = Math.max(0, Math.min(newY, maxY));
};

const stopDragging = (): void => {
	isDragging.value = false;
	document.removeEventListener("mousemove", handleDrag);
	document.removeEventListener("mouseup", stopDragging);

	// Save position to store
	videoPlayerPosition.value = { ...playerPosition.value };
};

// Resizing functionality
const startResizing = (event: MouseEvent): void => {
	isResizing.value = true;
	resizeStart.value = {
		x: event.clientX,
		y: event.clientY,
		width: playerPosition.value.width,
		height: playerPosition.value.height,
	};

	document.addEventListener("mousemove", handleResize);
	document.addEventListener("mouseup", stopResizing);
	event.preventDefault();
};

const handleResize = (event: MouseEvent): void => {
	if (!isResizing.value) return;

	const deltaX = event.clientX - resizeStart.value.x;
	const deltaY = event.clientY - resizeStart.value.y;

	const newWidth = Math.max(
		280,
		Math.min(800, resizeStart.value.width + deltaX),
	);
	const newHeight = Math.max(
		200,
		Math.min(600, resizeStart.value.height + deltaY),
	);

	// Keep within viewport bounds
	const maxX = window.innerWidth - newWidth;
	const maxY = window.innerHeight - newHeight;

	playerPosition.value.width = newWidth;
	playerPosition.value.height = newHeight;

	// Adjust position if resizing pushes it out of bounds
	if (playerPosition.value.x > maxX) {
		playerPosition.value.x = Math.max(0, maxX);
	}
	if (playerPosition.value.y > maxY) {
		playerPosition.value.y = Math.max(0, maxY);
	}
};

const stopResizing = (): void => {
	isResizing.value = false;
	document.removeEventListener("mousemove", handleResize);
	document.removeEventListener("mouseup", stopResizing);

	// Save position and size to store
	videoPlayerPosition.value = { ...playerPosition.value };
};

// Left-bottom resizing functionality
const startResizingLeft = (event: MouseEvent): void => {
	isResizingLeft.value = true;
	resizeStart.value = {
		x: event.clientX,
		y: event.clientY,
		width: playerPosition.value.width,
		height: playerPosition.value.height,
	};

	document.addEventListener("mousemove", handleResizeLeft);
	document.addEventListener("mouseup", stopResizingLeft);
	event.preventDefault();
};

const handleResizeLeft = (event: MouseEvent): void => {
	if (!isResizingLeft.value) return;

	const deltaX = event.clientX - resizeStart.value.x;
	const deltaY = event.clientY - resizeStart.value.y;

	const newWidth = Math.max(
		280,
		Math.min(800, resizeStart.value.width - deltaX),
	);
	const newHeight = Math.max(
		200,
		Math.min(600, resizeStart.value.height + deltaY),
	);

	// Adjust position when resizing from left
	const widthDelta = newWidth - playerPosition.value.width;
	const newX = Math.max(0, playerPosition.value.x - widthDelta);

	// Keep within viewport bounds
	const maxY = window.innerHeight - newHeight;

	playerPosition.value.width = newWidth;
	playerPosition.value.height = newHeight;
	playerPosition.value.x = newX;

	// Adjust position if resizing pushes it out of bounds
	if (playerPosition.value.y > maxY) {
		playerPosition.value.y = Math.max(0, maxY);
	}
};

const stopResizingLeft = (): void => {
	isResizingLeft.value = false;
	document.removeEventListener("mousemove", handleResizeLeft);
	document.removeEventListener("mouseup", stopResizingLeft);

	// Save position and size to store
	videoPlayerPosition.value = { ...playerPosition.value };
};

// Initialize position from store
const initializePosition = (): void => {
	// Ensure position is within current viewport bounds
	const maxX = window.innerWidth - playerPosition.value.width;
	const maxY = window.innerHeight - playerPosition.value.height;

	playerPosition.value.x = Math.max(0, Math.min(playerPosition.value.x, maxX));
	playerPosition.value.y = Math.max(0, Math.min(playerPosition.value.y, maxY));

	// Update store if position was adjusted
	if (
		playerPosition.value.x !== videoPlayerPosition.value.x ||
		playerPosition.value.y !== videoPlayerPosition.value.y
	) {
		videoPlayerPosition.value = { ...playerPosition.value };
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

// Handle window resize to keep player in bounds
const handleWindowResize = (): void => {
	if (props.isOpen) {
		initializePosition();
	}
};

// Lifecycle hooks
onMounted(() => {
	document.addEventListener("keydown", handleKeydown);
	window.addEventListener("resize", handleWindowResize);
	if (props.isOpen) {
		nextTick(() => {
			initializePosition();
		});
	}
});

onUnmounted(() => {
	document.removeEventListener("keydown", handleKeydown);
	window.removeEventListener("resize", handleWindowResize);
	document.removeEventListener("mousemove", handleDrag);
	document.removeEventListener("mouseup", stopDragging);
	document.removeEventListener("mousemove", handleResize);
	document.removeEventListener("mouseup", stopResizing);
	document.removeEventListener("mousemove", handleResizeLeft);
	document.removeEventListener("mouseup", stopResizingLeft);
	destroyPlayer();
});

// Watch for store changes and update local position
watch(
	videoPlayerPosition,
	(newPosition) => {
		playerPosition.value = { ...newPosition };
	},
	{ deep: true },
);
</script>
