import {
	getOdesliSongData,
	isOdesliError,
	extractPlatformIds,
	extractMostCommonTitleAndArtist,
} from "../../utils/odesli";
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

		// Read existing song data or create empty object
		let songData: SongMetaData;
		try {
			const fileContent = await fs.readFile(filePath, "utf-8");
			songData = JSON.parse(fileContent);
		} catch (error) {
			// Create empty song data object
			songData = {
				youtubeId,
				title: "",
				artist: "",
				lastFetched: new Date().toISOString(),
			};
		}

		// Check if Odesli data already exists and is recent (less than 7 days old)
		if (songData.odesli && Object.keys(songData.odesli).length > 0) {
			const lastFetched = new Date(songData.lastFetched);
			const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

			if (lastFetched.getTime() > sevenDaysAgo) {
				return songData;
			}
		}

		// Fetch Odesli data
		const odesliResult = await getOdesliSongData(youtubeId);

		if (isOdesliError(odesliResult)) {
			throw createError({
				statusCode: 404,
				statusMessage: "Odesli lookup failed",
			});
		}

		// Extract platform IDs and metadata
		const platformIds = extractPlatformIds(odesliResult);
		const { title: normalizedTitle, artist: normalizedArtist } =
			extractMostCommonTitleAndArtist(odesliResult);

		// Only update and save if there are more than 3 platformIds
		if (Object.keys(platformIds).length > 3) {
			// Update song data with Odesli results
			songData.odesli = platformIds;
			songData.title = normalizedTitle;
			songData.artist = normalizedArtist;
			songData.lastFetched = new Date().toISOString();

			// Save the file
			try {
				await fs.mkdir(songsDir, { recursive: true });
				await fs.writeFile(
					filePath,
					JSON.stringify(songData, null, 2),
					"utf-8",
				);
			} catch (fileError) {
				throw createError({
					statusCode: 500,
					statusMessage: "Failed to save Odesli data",
				});
			}
		}

		return songData;
	} catch (error: any) {
		console.error("Error augmenting song data with Odesli:", error);

		throw createError({
			statusCode: error.statusCode || 500,
			statusMessage:
				error.statusMessage || "Failed to augment song data with Odesli",
		});
	}
});
