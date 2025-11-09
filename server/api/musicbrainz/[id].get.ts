import { MusicBrainzApi } from "musicbrainz-api";
import { promises as fs } from "fs";
import { join } from "path";
import type { MusicBrainzSongData, MusicBrainzResponse } from "~/types";

const mbApi = new MusicBrainzApi({
	appName: "MusicPlaylistView",
	appVersion: "1.0.0",
	appContactInfo: "contact@example.com",
});

export default defineEventHandler(async (event) => {
	try {
		const mbid = getRouterParam(event, "id");
		const youtubeId = getQuery(event).youtubeId as string;

		if (!mbid) {
			throw createError({
				statusCode: 400,
				statusMessage: "MusicBrainz ID is required",
			});
		}

		if (!youtubeId) {
			throw createError({
				statusCode: 400,
				statusMessage: "YouTube ID is required",
			});
		}

		// Define the file path for caching
		const songsDir = join(process.cwd(), "public", "songs");
		const filePath = join(songsDir, `${youtubeId}.json`);

		// Check if cached file exists and is recent (less than 7 days old)
		try {
			const stats = await fs.stat(filePath);
			const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

			if (stats.mtime.getTime() > weekAgo) {
				// Return cached data
				const cachedData = await fs.readFile(filePath, "utf-8");
				const parsedData = JSON.parse(cachedData);

				return {
					success: true,
					data: parsedData,
					cached: true,
				} as MusicBrainzResponse;
			}
		} catch (error) {
			// File doesn't exist or error reading it, continue to fetch fresh data
		}

		// Fetch recording details from MusicBrainz using the API library
		const recordingData = (await mbApi.lookup("recording", mbid, [
			"artist-credits",
			"releases",
			"tags",
		])) as any;

		if (!recordingData) {
			throw createError({
				statusCode: 404,
				statusMessage: "Recording not found in MusicBrainz",
			});
		}

		// Extract tags (genres and other metadata)
		const tags = recordingData.tags?.map((tag: any) => tag.name) || [];

		// Count total releases
		const releaseCount = recordingData.releases?.length || 0;

		// Extract artist MBID
		const artistMbid = recordingData["artist-credit"]?.[0]?.artist?.id;

		// Create song data object
		const songData: MusicBrainzSongData = {
			mbid: mbid,
			title: recordingData.title || "Unknown Title",
			artist: recordingData["artist-credit"]?.[0]?.name || "Unknown Artist",
			artistMbid: artistMbid,
			releaseCount: releaseCount,
			tags: tags,
			duration: recordingData.length
				? Math.round(recordingData.length / 1000)
				: undefined,
			youtubeId: youtubeId,
			lastFetched: new Date().toISOString(),
		};

		// Store the song data to file
		try {
			// Ensure the songs directory exists
			await fs.mkdir(songsDir, { recursive: true });

			// Write the song data to file
			await fs.writeFile(filePath, JSON.stringify(songData, null, 2), "utf-8");
		} catch (fileError) {
			console.warn("Failed to cache song data:", fileError);
		}

		return {
			success: true,
			data: songData,
			cached: false,
		} as MusicBrainzResponse;
	} catch (error: any) {
		console.error("Error fetching MusicBrainz data:", error);

		throw createError({
			statusCode: error.statusCode || 500,
			statusMessage: error.statusMessage || "Failed to fetch MusicBrainz data",
		});
	}
});
