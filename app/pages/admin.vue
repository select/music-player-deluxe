<template>
	<div class="p-8 max-w-6xl mx-auto">
		<div class="flex items-center justify-between mb-8">
			<h1 class="text-3xl font-bold flex items-center gap-3">
				<div class="i-mdi-cog" />
				Admin Panel
			</h1>
			<AppBtn icon="i-mdi-arrow-left" variant="primary" to="/">
				Back to Playlists
			</AppBtn>
		</div>

		<div class="flex flex-col gap-6">
			<!-- Playlist Input Form -->
			<div class="rounded-lg mb-8 shadow-sm">
				<h2 class="text-xl font-semibold mb-4 flex items-center gap-2">
					<div class="i-mdi-plus" />
					Add New Playlist
				</h2>

				<form class="space-y-4" @submit.prevent="fetchPlaylist">
					<AppInputText
						id="playlistId"
						v-model="playlistInput"
						label="YouTube Playlist ID or URL"
						placeholder="Enter playlist ID (e.g., PLrAXtmRdnEQy8VVXvSgb5eKzwJJxd0FMz) or full URL"
						class="max-w-xl"
						help-text="You can paste either the playlist ID or the full YouTube playlist URL"
						:disabled="loading"
						required
					/>

					<AppBtn
						type="submit"
						icon="i-mdi-download"
						size="medium"
						:disabled="!playlistInput.trim()"
						:loading="loading"
						:show-text-while-loading="true"
					>
						{{ loading ? "Loading..." : "Load Playlist" }}
					</AppBtn>
				</form>
			</div>

			<!-- Success Message -->
			<div v-if="success" class="rounded-lg p-4 mb-8">
				<div class="flex items-center gap-2">
					<div class="i-mdi-check-circle" />
					<strong>Success:</strong> {{ success }}
				</div>
			</div>

			<!-- Error Message -->
			<div v-if="error" class="rounded-lg p-4 mb-8">
				<div class="flex items-center gap-2">
					<div class="i-mdi-alert-circle" />
					<strong>Error:</strong> {{ error }}
				</div>
			</div>

			<!-- Current Cached Playlists -->
			<div class="rounded-lg shadow-sm">
				<div class="flex items-center justify-between mb-4">
					<h2 class="text-xl font-semibold flex items-center gap-2">
						<div class="i-mdi-playlist-play" />
						Cached Playlists
					</h2>
					<AppBtn
						icon="i-mdi-refresh"
						size="small"
						:loading="loadingCached"
						@click="loadCachedPlaylists"
					>
						Refresh
					</AppBtn>
				</div>

				<div v-if="loadingCached" class="text-center py-8">
					<div class="i-mdi-loading animate-spin text-2xl mb-2" />
					<p class="">Loading cached playlists...</p>
				</div>

				<div v-else-if="!cachedPlaylists.length" class="text-center py-8">
					<div class="i-mdi-playlist-remove text-4xl mb-2" />
					<p class="">No cached playlists found.</p>
				</div>

				<div v-else class="space-y-4">
					<div
						v-for="playlist in cachedPlaylists"
						:key="playlist.id"
						class="flex items-center justify-between rounded-lg hover:bg-bg-gradient py-6"
					>
						<!-- Playlist Info -->
						<div class="flex-1">
							<h3 class="font-medium text-primary-3">{{ playlist.title }}</h3>
							<p class="text-sm">
								{{ playlist.videoCount }} videos • Last updated:
								{{ formatDate(playlist.lastFetched) }}
							</p>
							<p v-if="playlist.description" class="text-xs mt-1 line-clamp-2">
								{{ playlist.description }}
							</p>
						</div>
						<div class="flex items-center gap-2 ml-4">
							<AppBtn
								icon="i-mdi-database-plus"
								size="small"
								variant="primary"
								:loading="updatingMusicDataId === playlist.id"
								@click="updateAllMusicData(playlist.id)"
							>
								Update All Music Data
							</AppBtn>
							<AppBtn
								icon="i-mdi-pencil"
								size="small"
								variant="secondary"
								:loading="editingId === playlist.id"
								@click="editPlaylist(playlist)"
							>
								Edit
							</AppBtn>
							<AppBtn
								icon="i-mdi-refresh"
								size="small"
								:loading="refreshingId === playlist.id"
								@click="refreshCachedPlaylist(playlist.id)"
							>
								Update
							</AppBtn>
							<AppBtn
								icon="i-mdi-delete"
								size="small"
								variant="danger"
								:loading="deletingId === playlist.id"
								@click="deleteCachedPlaylist(playlist.id)"
							>
								Delete
							</AppBtn>
						</div>
					</div>
				</div>
			</div>

			<!-- Video List Section -->
			<div v-if="editingPlaylist" class="rounded-lg shadow-sm">
				<div class="flex items-center justify-between mb-4">
					<h2 class="text-xl font-semibold flex items-center gap-2">
						<div class="i-mdi-pencil" />
						Editing: {{ editingPlaylist.title }}
					</h2>
					<AppBtn
						icon="i-mdi-close"
						size="small"
						variant="ghost"
						@click="closeEditPlaylist"
					>
						Close
					</AppBtn>
				</div>

				<div v-if="loadingPlaylistVideos" class="text-center py-8">
					<div class="i-mdi-loading animate-spin text-2xl mb-2" />
					<p class="">Loading playlist videos...</p>
				</div>

				<AdminVideoList
					v-else-if="playlistVideos.length"
					:videos="playlistVideos"
				/>

				<div v-else class="text-center py-8">
					<div class="i-mdi-video-off text-4xl mb-2" />
					<p class="">No videos found in this playlist.</p>
				</div>
			</div>

			<!-- Tag Blacklist Management -->
			<AdminTagBlacklist />
		</div>
	</div>
</template>

<script setup lang="ts">
import type {
	PlaylistSummary,
	Video,
	ApiResponse,
	Playlist,
	UpdateDataResponse,
} from "~/types";
// Page metadata
useHead({
	title: "Admin Panel - Music Playlist View",
	meta: [{ name: "description", content: "Manage your YouTube playlists" }],
});

// Reactive data
const playlistInput = ref("");
const loading = ref(false);
const error = ref<string>("");
const success = ref<string>("");
const cachedPlaylists = ref<PlaylistSummary[]>([]);
const loadingCached = ref<boolean>(true);
const refreshingId = ref<string | null>(null);
const deletingId = ref<string | null>(null);
const editingId = ref<string | null>(null);
const updatingMusicDataId = ref<string | null>(null);
const editingPlaylist = ref<PlaylistSummary | null>(null);
const playlistVideos = ref<Video[]>([]);
const loadingPlaylistVideos = ref<boolean>(false);

// Load cached playlists on mount
onMounted(async () => {
	await loadCachedPlaylists();
});

// Extract playlist ID from URL or use as-is if it's already an ID
const extractPlaylistId = (input: string): string => {
	const trimmed = input.trim();

	// If it looks like a URL, extract the playlist ID
	const urlMatch = trimmed.match(/[?&]list=([a-zA-Z0-9_-]+)/);
	if (urlMatch && urlMatch[1]) {
		return urlMatch[1];
	}

	// Otherwise, assume it's already a playlist ID
	return trimmed;
};

// Fetch playlist data
const fetchPlaylist = async () => {
	if (!playlistInput.value.trim()) return;

	loading.value = true;
	error.value = "";
	success.value = "";

	try {
		const playlistId = extractPlaylistId(playlistInput.value);

		if (!playlistId) {
			throw new Error("Invalid playlist ID or URL");
		}

		const response = await $fetch<ApiResponse<Playlist>>(
			`/api/playlists/${playlistId}`,
		);

		if (response.success) {
			success.value = `Successfully loaded playlist: ${response.data.title}`;
			playlistInput.value = "";

			// Refresh the cached playlists list
			await loadCachedPlaylists();
		} else {
			throw new Error("Failed to fetch playlist");
		}
	} catch (err: any) {
		console.error("Error fetching playlist:", err);
		error.value =
			err.data?.message ||
			err.message ||
			"Failed to fetch playlist. Please check the playlist ID and try again.";
	} finally {
		loading.value = false;
	}
};

// Load cached playlists
const loadCachedPlaylists = async () => {
	try {
		loadingCached.value = true;
		const response = (await $fetch("/index.json")) as any;

		if (response.success) {
			cachedPlaylists.value = response.data;
		}
	} catch (err: any) {
		console.error("Error loading cached playlists:", err);
	} finally {
		loadingCached.value = false;
	}
};

// Refresh a cached playlist
const refreshCachedPlaylist = async (playlistId: string): Promise<void> => {
	try {
		refreshingId.value = playlistId;

		const response = await $fetch<ApiResponse<Playlist>>(
			`/api/playlists/${playlistId}`,
		);

		if (response.success) {
			await loadCachedPlaylists();
			success.value = `Successfully updated playlist: ${response.data.title}`;
			error.value = "";
		}
	} catch (err: any) {
		console.error("Error refreshing playlist:", err);
		error.value = "Failed to refresh playlist";
		success.value = "";
	} finally {
		refreshingId.value = null;
	}
};

// Delete a cached playlist
const deleteCachedPlaylist = async (playlistId: string): Promise<void> => {
	if (!confirm("Are you sure you want to delete this cached playlist?")) {
		return;
	}

	try {
		deletingId.value = playlistId;

		// Call API to delete the cached file
		await $fetch(`/api/playlists/${playlistId}`, { method: "DELETE" as any });

		await loadCachedPlaylists();
		success.value = "Successfully deleted cached playlist";
		error.value = "";
	} catch (err: any) {
		console.error("Error deleting playlist:", err);
		error.value = "Failed to delete playlist";
		success.value = "";
	} finally {
		deletingId.value = null;
	}
};

// Format date for display
const formatDate = (dateString: string): string => {
	const date = new Date(dateString);
	return date.toLocaleDateString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
};

// Edit playlist - load full playlist data
const editPlaylist = async (playlist: PlaylistSummary): Promise<void> => {
	try {
		editingId.value = playlist.id;
		loadingPlaylistVideos.value = true;

		const response = (await $fetch(`/playlist/${playlist.fileName}`)) as any;

		if (response) {
			editingPlaylist.value = playlist;
			playlistVideos.value = response.videos || [];
		} else {
			throw new Error("Failed to load playlist videos");
		}
	} catch (err: any) {
		console.error("Error loading playlist for editing:", err);
		error.value = "Failed to load playlist videos";
		success.value = "";
	} finally {
		editingId.value = null;
		loadingPlaylistVideos.value = false;
	}
};

// Close edit playlist
const closeEditPlaylist = (): void => {
	editingPlaylist.value = null;
	playlistVideos.value = [];
};

// Update all music data for a playlist
const updateAllMusicData = async (playlistId: string): Promise<void> => {
	try {
		updatingMusicDataId.value = playlistId;
		error.value = "";
		success.value = "";

		const response = await $fetch<UpdateDataResponse>(
			"/api/playlists/update-data",
			{
				method: "POST",
				body: { playlistId },
			},
		);

		if (response.success) {
			success.value = response.message;
			// Refresh the cached playlists list to show updated data
			await loadCachedPlaylists();
		} else {
			throw new Error("Failed to update playlist music data");
		}
	} catch (err: any) {
		console.error("Error updating playlist music data:", err);
		error.value =
			err.data?.message ||
			err.message ||
			"Failed to update playlist music data";
		success.value = "";
	} finally {
		updatingMusicDataId.value = null;
	}
};
</script>
