import { promises as fs } from "fs";
import { join } from "path";
import type { Playlist, Video, MusicBrainzSongData } from "~/types";

interface UpdateDataRequest {
	playlistId: string;
}

interface UpdateDataResponse {
	success: boolean;
	message: string;
	updatedVideos: number;
	totalVideos: number;
}

export default defineEventHandler(async (event) => {
	try {
		const body = (await readBody(event)) as UpdateDataRequest;

		if (!body.playlistId) {
			throw createError({
				statusCode: 400,
				statusMessage: "Playlist ID is required",
			});
		}

		const { playlistId } = body;

		// Define paths
		const playlistsDir = join(process.cwd(), "public", "playlists");
		const songsDir = join(process.cwd(), "public", "songs");
		const playlistFilePath = join(playlistsDir, `${playlistId}.json`);

		// Read the playlist file
		let playlistData: Playlist;
		try {
			const playlistContent = await fs.readFile(playlistFilePath, "utf-8");
			playlistData = JSON.parse(playlistContent);
		} catch (error) {
			throw createError({
				statusCode: 404,
				statusMessage: `Playlist ${playlistId} not found`,
			});
		}

		// Read all song files to create a lookup map
		const songDataMap = new Map<string, MusicBrainzSongData>();
		try {
			const songFiles = await fs.readdir(songsDir);

			for (const songFile of songFiles) {
				if (songFile.endsWith('.json')) {
					try {
						const songFilePath = join(songsDir, songFile);
						const songContent = await fs.readFile(songFilePath, "utf-8");
						const songData: MusicBrainzSongData = JSON.parse(songContent);

						// Map by YouTube ID (filename without .json extension)
						const youtubeId = songFile.replace('.json', '');
						songDataMap.set(youtubeId, songData);
					} catch (songError) {
						console.warn(`Failed to read song file ${songFile}:`, songError);
					}
				}
			}
		} catch (error) {
			console.warn("Failed to read songs directory:", error);
		}

		// Update videos with music data
		let updatedCount = 0;
		const updatedVideos: Video[] = playlistData.videos.map((video) => {
			const songData = songDataMap.get(video.id);

			if (songData) {
				// Fuse artistTags and tags
				const fusedTags: string[] = [];

				// Add recording tags
				if (songData.tags && songData.tags.length > 0) {
					fusedTags.push(...songData.tags);
				}

				// Add artist tags
				if (songData.artistTags && songData.artistTags.length > 0) {
					fusedTags.push(...songData.artistTags);
				}

				// Remove duplicates and sort
				const uniqueTags = Array.from(new Set(fusedTags)).sort();

				// Update video with music data
				const hasChanges =
					video.artist !== songData.artist ||
					video.musicTitle !== songData.title ||
					JSON.stringify(video.tags || []) !== JSON.stringify(uniqueTags);

				if (hasChanges) {
					updatedCount++;
				}

				return {
					...video,
					artist: songData.artist,
					musicTitle: songData.title,
					tags: uniqueTags.length > 0 ? uniqueTags : undefined,
				};
			}

			return video;
		});

		// Update the playlist data
		const updatedPlaylistData: Playlist = {
			...playlistData,
			videos: updatedVideos,
			lastFetched: new Date().toISOString(),
		};

		// Write the updated playlist back to file
		try {
			await fs.writeFile(
				playlistFilePath,
				JSON.stringify(updatedPlaylistData, null, 2),
				"utf-8"
			);
		} catch (writeError) {
			throw createError({
				statusCode: 500,
				statusMessage: "Failed to save updated playlist",
			});
		}

		return {
			success: true,
			message: `Successfully updated ${updatedCount} videos with music data`,
			updatedVideos: updatedCount,
			totalVideos: playlistData.videos.length,
		} as UpdateDataResponse;

	} catch (error: any) {
		console.error("Error updating playlist music data:", error);

		throw createError({
			statusCode: error.statusCode || 500,
			statusMessage: error.statusMessage || "Failed to update playlist music data",
		});
	}
});
