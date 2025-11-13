import { Client } from "youtubei";
import { promises as fs } from "fs";
import { join } from "path";
import type { Video, Playlist, PlaylistSummary, ApiResponse } from "~/types";

export default defineEventHandler(async (event) => {
	try {
		const playlistId = getRouterParam(event, "id");

		if (!playlistId) {
			throw createError({
				statusCode: 400,
				statusMessage: "Playlist ID is required",
			});
		}

		// Define the file path for caching
		const playlistsDir = join(process.cwd(), "public", "playlist");
		const filePath = join(playlistsDir, `${playlistId}.json`);

		// Check if cached file exists and is recent (less than 1 hour old)
		try {
			const stats = await fs.stat(filePath);
			const hourAgo = Date.now() - 60 * 60 * 1000; // 1 hour in milliseconds

			if (stats.mtime.getTime() > hourAgo) {
				// Return cached data
				const cachedData = await fs.readFile(filePath, "utf-8");
				const parsedData = JSON.parse(cachedData);

				return {
					success: true,
					data: parsedData,
					cached: true,
				} as ApiResponse<Playlist>;
			}
		} catch (error) {
			// File doesn't exist or error reading it, continue to fetch fresh data
		}

		// Initialize YouTube client
		const youtube = new Client();

		// Get playlist
		const playlist = await youtube.getPlaylist(playlistId);

		if (!playlist) {
			throw createError({
				statusCode: 404,
				statusMessage: "Playlist not found",
			});
		}

		// Load all videos in the playlist using pagination
		// By default, only the first ~100 videos are loaded initially
		// Calling next(0) loads ALL remaining videos in the playlist
		if (
			playlist.videos &&
			typeof playlist.videos === "object" &&
			"next" in playlist.videos
		) {
			await playlist.videos.next(0);
		}

		// Extract video information from playlist.videos
		const videoList = Array.isArray(playlist.videos)
			? playlist.videos
			: playlist.videos?.items || [];
		const videos: Video[] = videoList.map((video: any) => ({
			id: video.id,
			title: video.title || "Unknown Title",
			channel: video.channel?.name || "Unknown Channel",
			duration: video.duration
				? formatDuration(video.duration)
				: "Unknown Duration",
		}));

		const playlistData: Playlist = {
			id: playlist.id,
			title: playlist.title,
			description: (playlist as any).description || "",
			videoCount: playlist.videoCount,
			videos: videos,
			lastFetched: new Date().toISOString(),
		};

		// Store the playlist data to file
		try {
			// Ensure the playlists directory exists
			await fs.mkdir(playlistsDir, { recursive: true });

			// Write the playlist data to file
			await fs.writeFile(
				filePath,
				JSON.stringify(playlistData, null, 2),
				"utf-8",
			);

			// Update the index file
			await updateIndexFile(playlistsDir, playlistData);
		} catch (fileError) {
			console.warn("Failed to cache playlist data:", fileError);
		}

		return {
			success: true,
			data: playlistData,
			cached: false,
		} as ApiResponse<Playlist>;
	} catch (error: any) {
		console.error("Error fetching playlist:", error);

		throw createError({
			statusCode: error.statusCode || 500,
			statusMessage: error.statusMessage || "Failed to fetch playlist",
		});
	}
});

// Helper function to format duration from seconds to readable format
function formatDuration(seconds: number): string {
	if (!seconds || seconds <= 0) return "Unknown Duration";

	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const remainingSeconds = seconds % 60;

	if (hours > 0) {
		return `${hours}:${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
	} else {
		return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
	}
}

// Helper function to update the index file with playlist summaries
async function updateIndexFile(
	playlistsDir: string,
	newPlaylistData: Playlist,
): Promise<void> {
	try {
		const indexFilePath = join(process.cwd(), "public", "index.json");

		// Read existing index or create empty array
		let index: PlaylistSummary[] = [];
		try {
			const indexContent = await fs.readFile(indexFilePath, "utf-8");
			index = JSON.parse(indexContent);
		} catch (error) {
			// File doesn't exist or is invalid, start with empty array
			index = [];
		}

		// Create playlist summary for index
		const playlistSummary: PlaylistSummary = {
			id: newPlaylistData.id,
			title: newPlaylistData.title,
			description: newPlaylistData.description,
			videoCount: newPlaylistData.videoCount,
			lastFetched: newPlaylistData.lastFetched,
			fileName: `${newPlaylistData.id}.json`,
		};

		// Remove existing entry if it exists
		index = index.filter((item) => item.id !== newPlaylistData.id);

		// Add new entry
		index.push(playlistSummary);

		// Sort by lastFetched (newest first)
		index.sort(
			(a, b) =>
				new Date(b.lastFetched).getTime() - new Date(a.lastFetched).getTime(),
		);

		// Write updated index
		await fs.writeFile(
			indexFilePath,
			JSON.stringify(
				{
					success: true,
					data: index,
					count: index.length,
					lastUpdated: new Date().toISOString(),
				},
				null,
				2,
			),
			"utf-8",
		);
	} catch (error) {
		console.warn("Failed to update index file:", error);
	}
}
