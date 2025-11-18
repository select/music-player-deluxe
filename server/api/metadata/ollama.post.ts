import { extractMetadataWithOllama } from "../../utils/ollama";
import { getSongData, updateSongData } from "../../utils/songData";

export default defineEventHandler(async (event) => {
	try {
		const { youtubeId, title, channel } = await readBody(event);

		if (!youtubeId || !title || !channel) {
			throw createError({
				statusCode: 400,
				statusMessage: "YouTube ID, title, and channel are required",
			});
		}

		// Read existing song data
		const songData = await getSongData(youtubeId);

		// Extract metadata using Ollama
		const extractedMetadata = await extractMetadataWithOllama(
			youtubeId,
			title,
			channel,
		);

		if (!extractedMetadata) {
			throw createError({
				statusCode: 404,
				statusMessage: "Ollama metadata extraction failed",
			});
		}

		// Update song data with extracted metadata
		songData.title = extractedMetadata.title;
		songData.artist = extractedMetadata.artist;

		// Save the updated data
		try {
			await updateSongData(songData);
		} catch (_fileError) {
			throw createError({
				statusCode: 500,
				statusMessage: "Failed to save Ollama metadata",
			});
		}

		return {
			title: extractedMetadata.title,
			artist: extractedMetadata.artist,
		};
	} catch (error: any) {
		console.error("Error augmenting song data with Ollama:", error);

		throw createError({
			statusCode: error.statusCode || 500,
			statusMessage:
				error.statusMessage || "Failed to augment song data with Ollama",
		});
	}
});
