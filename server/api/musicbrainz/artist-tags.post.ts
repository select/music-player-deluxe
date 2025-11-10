import { MusicBrainzApi } from "musicbrainz-api";
import { promises as fs } from "fs";
import { join } from "path";
import type { MusicBrainzSongData } from "~/types";

const mbApi = new MusicBrainzApi({
	appName: "MusicPlaylistView",
	appVersion: "1.0.0",
	appContactInfo: "contact@example.com",
});

export default defineEventHandler(async (event) => {
	try {
		const { youtubeId } = await readBody(event);

		if (!youtubeId) {
			throw createError({
				statusCode: 400,
				statusMessage: "YouTube ID is required",
			});
		}

		// Define the file path for the song data
		const songsDir = join(process.cwd(), "server", "assets", "songs");
		const filePath = join(songsDir, `${youtubeId}.json`);

		// Read existing song data
		let songData: MusicBrainzSongData;
		try {
			const fileContent = await fs.readFile(filePath, "utf-8");
			songData = JSON.parse(fileContent);
		} catch (error) {
			throw createError({
				statusCode: 404,
				statusMessage:
					"Song data not found. Please ensure the song has MusicBrainz data first.",
			});
		}

		// Check if artist tags already exist and are recent (less than 30 days old)
		if (songData.artistTags && songData.artistTags.length > 0) {
			const lastFetched = new Date(songData.lastFetched);
			const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

			if (lastFetched.getTime() > thirtyDaysAgo) {
				return {
					success: true,
					data: songData,
					cached: true,
				};
			}
		}

		// Use stored artistMbid if available, otherwise fetch from recording data
		let artistMbid = songData.artistMbid;

		if (!artistMbid) {
			// Fallback: get the recording data to extract artist MBID
			const recordingData = (await mbApi.lookup("recording", songData.mbid, [
				"artist-credits",
			])) as any;

			if (
				!recordingData ||
				!recordingData["artist-credit"] ||
				recordingData["artist-credit"].length === 0
			) {
				throw createError({
					statusCode: 404,
					statusMessage: `Recording "${songData.mbid}" not found or has no artist credits`,
				});
			}

			// Get the primary artist MBID from the recording
			artistMbid = recordingData["artist-credit"][0].artist.id;

			if (!artistMbid) {
				throw createError({
					statusCode: 404,
					statusMessage: "Artist MBID not found in recording data",
				});
			}

			// Store the artistMbid for future use
			songData.artistMbid = artistMbid;
		}

		// Fetch artist details with tags using the MBID from the recording
		const artistData = (await mbApi.lookup("artist", artistMbid, [
			"tags",
		])) as any;

		// Extract artist tags
		const artistTags = artistData.tags?.map((tag: any) => tag.name) || [];

		// Update song data with artist tags
		songData.artistTags = artistTags;
		songData.lastFetched = new Date().toISOString();

		// Save updated song data back to file
		try {
			await fs.writeFile(filePath, JSON.stringify(songData, null, 2), "utf-8");
		} catch (fileError) {
			console.warn("Failed to update song data with artist tags:", fileError);
			throw createError({
				statusCode: 500,
				statusMessage: "Failed to save artist tags",
			});
		}

		return {
			success: true,
			data: songData,
			cached: false,
		};
	} catch (error: any) {
		console.error("Error fetching artist tags:", error);

		throw createError({
			statusCode: error.statusCode || 500,
			statusMessage: error.statusMessage || "Failed to fetch artist tags",
		});
	}
});
