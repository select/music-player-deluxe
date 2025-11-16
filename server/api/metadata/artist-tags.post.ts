import { getMusicBrainzArtistTags } from "../../utils/musicbrainzArtistTags";
import { promises as fs } from "fs";
import { join } from "path";
import type { SongMetaData } from "~/types";

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

		// Read existing song data to get the mbid
		let songData: SongMetaData;
		try {
			const fileContent = await fs.readFile(filePath, "utf-8");
			songData = JSON.parse(fileContent);
		} catch {
			throw createError({
				statusCode: 404,
				statusMessage:
					"Song data not found. Please ensure the song has MusicBrainz data first.",
			});
		}

		if (!songData.mbid) {
			throw createError({
				statusCode: 400,
				statusMessage: "Song data does not contain a MusicBrainz ID",
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

		// Use the utility function to get artist tags
		const artistTags = await getMusicBrainzArtistTags(songData.mbid);

		// Update the song data with the fetched artist tags
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
