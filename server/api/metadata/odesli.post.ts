import {
	getOdesliSongData,
	isOdesliError,
	extractPlatformIds,
	extractMostCommonTitleAndArtist,
} from "../../utils/odesli";
import {
	getSongData,
	updateSongData,
	isDataRecent,
} from "../../utils/songData";

export default defineEventHandler(async (event) => {
	try {
		const { youtubeId } = await readBody(event);

		if (!youtubeId) {
			throw createError({
				statusCode: 400,
				statusMessage: "YouTube ID is required",
			});
		}

		// Read existing song data
		const songData = await getSongData(youtubeId);

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

			// Save the file
			try {
				await updateSongData(songData);
			} catch (fileError) {
				throw createError({
					statusCode: 500,
					statusMessage: "Failed to save Odesli data",
				});
			}
		} else {
			throw createError({
				statusCode: 404,
				statusMessage: "Odesli lookup failed",
			});
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
