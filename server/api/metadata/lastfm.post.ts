import {
	getTrackInfo,
	transformLastfmData,
	searchTrack,
	getBestTrackMatch,
} from "../../utils/lastfm";
import { getSongData, updateSongData } from "../../utils/songData";

export default defineEventHandler(async (event) => {
	try {
		const { youtubeId, artist, title } = await readBody(event);

		if (!youtubeId || !artist || !title) {
			throw createError({
				statusCode: 400,
				statusMessage: "YouTube ID, artist, and title are required",
			});
		}

		// Read existing song data
		const songData = await getSongData(youtubeId);

		// Early return if Last.fm data already exists
		if (songData.lastfmId) {
			return songData;
		}

		let lastfmResult;
		// Fetch Last.fm data
		try {
			lastfmResult = await getTrackInfo(artist, title);
			if (!lastfmResult) {
				throw createError({
					statusCode: 404,
					statusMessage:
						"Last.fm result does not match the requested artist and title",
				});
			}
			// Check if artist and title match the Last.fm result
			const resultArtist = lastfmResult?.artist?.name?.toLowerCase() || "";
			const resultTitle = lastfmResult?.name?.toLowerCase() || "";
			const inputArtist = artist.toLowerCase();
			const inputTitle = title.toLowerCase();

			if (resultArtist !== inputArtist || resultTitle !== inputTitle) {
				throw createError({
					statusCode: 404,
					statusMessage:
						"Last.fm result does not match the requested artist and title",
				});
			}
		} catch {
			throw createError({
				statusCode: 500,
				statusMessage: "Faild to get last.fm track info",
			});
		}
		// Only update and save if the data is meaningful
		if (
			lastfmResult?.listeners &&
			parseInt(lastfmResult.listeners || "0") > 5
		) {
			// Save the file
			try {
				const lastfmData = transformLastfmData(lastfmResult);
				await updateSongData({
					...songData,
					...lastfmData,
					// Preserve existing mbid if it exists
					mbid: songData.mbid || lastfmData.mbid,
				});
			} catch {
				throw createError({
					statusCode: 500,
					statusMessage: "Failed to save Last.fm data",
				});
			}
		} else {
			throw createError({
				statusCode: 404,
				statusMessage: "Last.fm lookup returned insufficient data",
			});
		}

		const lastfmData = transformLastfmData(lastfmResult);
		return {
			...songData,
			...lastfmData,
			// Preserve existing mbid if it exists
			mbid: songData.mbid || lastfmData.mbid,
		};
	} catch (error: any) {
		console.error("Error augmenting song data with Last.fm:", error);

		throw createError({
			statusCode: error.statusCode || 500,
			statusMessage:
				error.statusMessage || "Failed to augment song data with Last.fm",
		});
	}
});
