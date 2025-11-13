import type { Video } from "~/types";

// Global state for the video player
const globalPlayerState = reactive({
	isPlaying: false,
	currentVideo: null as Video | null,
	currentIndex: 0,
	isPlayerReady: false,
	showPlayerBar: false,
	isFloatingPlayerOpen: false,
	youtubePlayerInstance: null as any,
});

export const useGlobalPlayer = () => {
	const { currentVideos } = storeToRefs(usePlaylistStore());

	// Computed properties
	const canPlayPrevious = computed(() => {
		if (!globalPlayerState.currentVideo) return false;

		const currentVideoIndex = currentVideos.value.findIndex(
			(video) => video.id === globalPlayerState.currentVideo?.id,
		);

		return currentVideoIndex > 0;
	});

	const canPlayNext = computed(() => {
		if (!globalPlayerState.currentVideo) return false;

		const currentVideoIndex = currentVideos.value.findIndex(
			(video) => video.id === globalPlayerState.currentVideo?.id,
		);

		// Can play next if current video is in the list and not the last one
		// OR if current video is not in the filtered list (can go to first video)
		return currentVideoIndex === -1
			? currentVideos.value.length > 0
			: currentVideoIndex < currentVideos.value.length - 1;
	});

	// Actions
	const setCurrentVideo = (video: Video | null): void => {
		globalPlayerState.currentVideo = video;
		globalPlayerState.showPlayerBar = !!video;
	};

	const setIsPlaying = (playing: boolean): void => {
		globalPlayerState.isPlaying = playing;
	};

	const setIsPlayerReady = (ready: boolean): void => {
		globalPlayerState.isPlayerReady = ready;
	};

	const setYouTubePlayerInstance = (player: any): void => {
		globalPlayerState.youtubePlayerInstance = player;
	};

	const togglePlayPause = (): void => {
		const player = globalPlayerState.youtubePlayerInstance;
		if (!player || !globalPlayerState.isPlayerReady) return;

		if (globalPlayerState.isPlaying) {
			player.pauseVideo();
		} else {
			player.playVideo();
		}
	};

	const setCurrentIndex = (index: number): void => {
		if (index >= 0 && index < currentVideos.value.length) {
			globalPlayerState.currentIndex = index;
			globalPlayerState.currentVideo = currentVideos.value[index] || null;
		}
	};

	const previousVideo = (): void => {
		if (!globalPlayerState.currentVideo) return;

		// Find current video in the current filtered playlist
		const currentVideoIndex = currentVideos.value.findIndex(
			(video) => video.id === globalPlayerState.currentVideo?.id,
		);

		if (currentVideoIndex > 0) {
			// Go to previous video in filtered playlist
			const previousIndex = currentVideoIndex - 1;
			globalPlayerState.currentIndex = previousIndex;
			globalPlayerState.currentVideo =
				currentVideos.value[previousIndex] || null;
		}
	};

	const nextVideo = (): void => {
		if (!globalPlayerState.currentVideo) return;

		// Find current video in the current filtered playlist
		const currentVideoIndex = currentVideos.value.findIndex(
			(video) => video.id === globalPlayerState.currentVideo?.id,
		);

		if (
			currentVideoIndex !== -1 &&
			currentVideoIndex < currentVideos.value.length - 1
		) {
			// Go to next video in filtered playlist
			const nextIndex = currentVideoIndex + 1;
			globalPlayerState.currentIndex = nextIndex;
			globalPlayerState.currentVideo = currentVideos.value[nextIndex] || null;
		} else if (currentVideoIndex === -1 && currentVideos.value.length > 0) {
			// Current video not in filtered list, go to first video of filtered playlist
			globalPlayerState.currentIndex = 0;
			globalPlayerState.currentVideo = currentVideos.value[0] || null;
		}
	};

	const playVideo = (index: number): void => {
		setCurrentIndex(index);
	};

	const closePlayer = (): void => {
		globalPlayerState.showPlayerBar = false;
		globalPlayerState.isFloatingPlayerOpen = false;
		globalPlayerState.currentVideo = null;
		globalPlayerState.isPlaying = false;
		globalPlayerState.isPlayerReady = false;
		globalPlayerState.youtubePlayerInstance = null;
	};

	const initializeGlobalPlayer = (index: number = 0): void => {
		setCurrentIndex(index);
		globalPlayerState.showPlayerBar = true;
		globalPlayerState.isFloatingPlayerOpen = true;
	};

	const openFloatingPlayer = (): void => {
		globalPlayerState.isFloatingPlayerOpen = true;
	};

	const closeFloatingPlayer = (): void => {
		globalPlayerState.isFloatingPlayerOpen = false;
	};

	return {
		// State (readonly)
		isPlaying: readonly(toRef(globalPlayerState, "isPlaying")),
		currentVideo: toRef(globalPlayerState, "currentVideo") as Ref<Video | null>,
		currentIndex: readonly(toRef(globalPlayerState, "currentIndex")),
		isPlayerReady: readonly(toRef(globalPlayerState, "isPlayerReady")),
		showPlayerBar: readonly(toRef(globalPlayerState, "showPlayerBar")),
		isFloatingPlayerOpen: readonly(
			toRef(globalPlayerState, "isFloatingPlayerOpen"),
		),
		canPlayPrevious,
		canPlayNext,

		// Actions
		setCurrentVideo,
		setIsPlaying,
		setIsPlayerReady,
		setCurrentIndex,
		setYouTubePlayerInstance,
		togglePlayPause,
		previousVideo,
		nextVideo,
		playVideo,
		closePlayer,
		initializeGlobalPlayer,
		openFloatingPlayer,
		closeFloatingPlayer,
	};
};
