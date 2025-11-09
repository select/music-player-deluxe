import type { Video } from "~/types";

// Global state for the video player
const globalPlayerState = reactive({
	isPlaying: false,
	currentVideo: null as Video | null,
	currentIndex: 0,
	playlist: [] as Video[],
	isPlayerReady: false,
	showPlayerBar: false,
	isFloatingPlayerOpen: false,
});

export const useGlobalPlayer = () => {
	// Computed properties
	const canPlayPrevious = computed(() => globalPlayerState.currentIndex > 0);
	const canPlayNext = computed(
		() =>
			globalPlayerState.currentIndex < globalPlayerState.playlist.length - 1,
	);

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

	const setPlaylist = (playlist: Video[]): void => {
		globalPlayerState.playlist = playlist;
	};

	const setCurrentIndex = (index: number): void => {
		if (index >= 0 && index < globalPlayerState.playlist.length) {
			globalPlayerState.currentIndex = index;
			globalPlayerState.currentVideo =
				globalPlayerState.playlist[index] || null;
		}
	};

	const previousVideo = (): void => {
		if (canPlayPrevious.value) {
			setCurrentIndex(globalPlayerState.currentIndex - 1);
		}
	};

	const nextVideo = (): void => {
		if (canPlayNext.value) {
			setCurrentIndex(globalPlayerState.currentIndex + 1);
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
	};

	const initializeGlobalPlayer = (
		playlist: Video[],
		index: number = 0,
	): void => {
		setPlaylist(playlist);
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
		playlist: toRef(globalPlayerState, "playlist") as Ref<Video[]>,
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
		setPlaylist,
		setCurrentIndex,
		previousVideo,
		nextVideo,
		playVideo,
		closePlayer,
		initializeGlobalPlayer,
		openFloatingPlayer,
		closeFloatingPlayer,
	};
};
