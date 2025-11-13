import type { Playlist, IndexResponse, Video } from "~/types";

export const usePlaylistStore = defineStore("playlistStore", () => {
	// State
	const currentPlaylist = ref<Playlist | null>(null);
	const originalCurrentPlaylist = ref<Playlist | null>(null);
	const loading = ref<boolean>(false);
	const error = ref<string>("");

	// Computed
	const hasCurrentPlaylist = computed(() => currentPlaylist.value !== null);
	const currentVideos = computed(() => currentPlaylist.value?.videos || []);

	// Helper function to sort videos by createdAt
	const sortVideosByCreatedAt = (videos: Video[]): Video[] => {
		return [...videos].sort((a, b) => {
			// Videos with createdAt come first
			if (a.createdAt && !b.createdAt) return -1;
			if (!a.createdAt && b.createdAt) return 1;

			// Both have createdAt, sort by latest first
			if (a.createdAt && b.createdAt) {
				return b.createdAt - a.createdAt;
			}

			// Neither have createdAt, maintain original order
			return 0;
		});
	};

	// Helper function to sort playlist videos initially
	const sortPlaylistVideos = (playlist: Playlist): Playlist => {
		return {
			...playlist,
			videos: sortVideosByCreatedAt(playlist.videos),
		};
	};

	// Actions
	const loadFirstPlaylist = async (): Promise<void> => {
		try {
			loading.value = true;
			error.value = "";

			// Load index to get first playlist info
			const indexResponse = await $fetch<IndexResponse>("/index.json");

			if (!indexResponse.success || !indexResponse.data.length) {
				currentPlaylist.value = null;
				originalCurrentPlaylist.value = null;
				return;
			}

			// Get the first playlist from index
			const firstPlaylistInfo = indexResponse.data[0];

			// Load the full playlist data with videos
			const playlistResponse = await $fetch<Playlist>(
				`/playlist/${firstPlaylistInfo?.fileName}`,
			);

			// Sort the playlist videos initially
			const sortedPlaylist = sortPlaylistVideos(playlistResponse);

			// Set as current playlist
			currentPlaylist.value = sortedPlaylist;
			// Keep original copy for reference
			originalCurrentPlaylist.value = JSON.parse(
				JSON.stringify(sortedPlaylist),
			);
		} catch (err: any) {
			console.error("Error loading first playlist:", err);
			error.value =
				err.data?.message || err.message || "Failed to load playlist";
			currentPlaylist.value = null;
			originalCurrentPlaylist.value = null;
		} finally {
			loading.value = false;
		}
	};

	const setCurrentPlaylistVideos = (videos: Video[]): void => {
		if (!currentPlaylist.value) return;

		currentPlaylist.value = {
			...currentPlaylist.value,
			videos: videos,
		};
	};

	const findVideoIndex = (videoId: string): number => {
		if (!currentPlaylist.value) return -1;
		return currentPlaylist.value.videos.findIndex((v) => v.id === videoId);
	};

	return {
		// State
		currentPlaylist,
		loading,
		error,

		// Computed
		hasCurrentPlaylist,
		originalCurrentPlaylist,
		currentVideos,

		// Actions
		loadFirstPlaylist,
		setCurrentPlaylistVideos,
		findVideoIndex,
		sortVideosByCreatedAt,
	};
});

if (import.meta.hot) {
	import.meta.hot.accept(acceptHMRUpdate(usePlaylistStore, import.meta.hot));
}
