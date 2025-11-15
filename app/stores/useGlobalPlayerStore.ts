import type { Video } from "~/types";

export const usePlayerStore = defineStore("Player", () => {
	// State
	const isPlaying = ref<boolean>(false);
	const currentVideo = ref<Video | null>(null);
	const currentIndex = ref<number>(0);
	const isPlayerReady = ref<boolean>(false);
	const showPlayerBar = ref<boolean>(false);
	const isFloatingPlayerOpen = ref<boolean>(false);
	const youtubePlayerInstance = ref<any>(null);

	// Get playlist store reference
	const { currentVideos } = storeToRefs(usePlaylistStore());

	// Computed properties
	const canPlayPrevious = computed(() => {
		if (!currentVideo.value) return false;

		const currentVideoIndex = currentVideos.value.findIndex(
			(video) => video.id === currentVideo.value?.id,
		);

		return currentVideoIndex > 0;
	});

	const canPlayNext = computed(() => {
		if (!currentVideo.value) return false;

		const currentVideoIndex = currentVideos.value.findIndex(
			(video) => video.id === currentVideo.value?.id,
		);

		// Can play next if current video is in the list and not the last one
		// OR if current video is not in the filtered list (can go to first video)
		return currentVideoIndex === -1
			? currentVideos.value.length > 0
			: currentVideoIndex < currentVideos.value.length - 1;
	});

	// Actions
	const setCurrentVideo = (video: Video | null): void => {
		currentVideo.value = video;
		showPlayerBar.value = !!video;
	};

	const setIsPlaying = (playing: boolean): void => {
		isPlaying.value = playing;
	};

	const setIsPlayerReady = (ready: boolean): void => {
		isPlayerReady.value = ready;
	};

	const setYouTubePlayerInstance = (player: any): void => {
		youtubePlayerInstance.value = player;
	};

	const togglePlayPause = (): void => {
		const player = youtubePlayerInstance.value;
		if (!player || !isPlayerReady.value) return;

		if (isPlaying.value) {
			player.pauseVideo();
		} else {
			player.playVideo();
		}
	};

	const setCurrentIndex = (index: number): void => {
		if (index >= 0 && index < currentVideos.value.length) {
			currentIndex.value = index;
			currentVideo.value = currentVideos.value[index] || null;
		}
	};

	const previousVideo = (): void => {
		if (!currentVideo.value) return;

		// Find current video in the current filtered playlist
		const currentVideoIndex = currentVideos.value.findIndex(
			(video) => video.id === currentVideo.value?.id,
		);

		if (currentVideoIndex > 0) {
			// Go to previous video in filtered playlist
			const previousIndex = currentVideoIndex - 1;
			currentIndex.value = previousIndex;
			currentVideo.value = currentVideos.value[previousIndex] || null;
		}
	};

	const nextVideo = (): void => {
		if (!currentVideo.value) return;

		// Find current video in the current filtered playlist
		const currentVideoIndex = currentVideos.value.findIndex(
			(video) => video.id === currentVideo.value?.id,
		);

		if (
			currentVideoIndex !== -1 &&
			currentVideoIndex < currentVideos.value.length - 1
		) {
			// Go to next video in filtered playlist
			const nextIndex = currentVideoIndex + 1;
			currentIndex.value = nextIndex;
			currentVideo.value = currentVideos.value[nextIndex] || null;
		} else if (currentVideoIndex === -1 && currentVideos.value.length > 0) {
			// Current video not in filtered list, go to first video of filtered playlist
			currentIndex.value = 0;
			currentVideo.value = currentVideos.value[0] || null;
		}
	};

	const playVideo = (index: number): void => {
		setCurrentIndex(index);
	};

	const closePlayer = (): void => {
		showPlayerBar.value = false;
		isFloatingPlayerOpen.value = false;
		currentVideo.value = null;
		isPlaying.value = false;
		isPlayerReady.value = false;
		youtubePlayerInstance.value = null;
	};

	const initializeGlobalPlayer = (index: number = 0): void => {
		setCurrentIndex(index);
		showPlayerBar.value = true;
		isFloatingPlayerOpen.value = true;
	};

	const openFloatingPlayer = (): void => {
		isFloatingPlayerOpen.value = true;
	};

	const closeFloatingPlayer = (): void => {
		isFloatingPlayerOpen.value = false;
	};

	return {
		// State
		isPlaying: readonly(isPlaying),
		currentVideo,
		currentIndex: readonly(currentIndex),
		isPlayerReady: readonly(isPlayerReady),
		showPlayerBar: readonly(showPlayerBar),
		isFloatingPlayerOpen: readonly(isFloatingPlayerOpen),

		// Computed
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
});

if (import.meta.hot) {
	import.meta.hot.accept(acceptHMRUpdate(usePlayerStore, import.meta.hot));
}
