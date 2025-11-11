import { promises as fs } from "fs";
import { join } from "path";
import type {
	MusicBrainzSongData,
	ApiResponse,
	YouTubeLinkMetadata,
} from "~/types";

export default defineEventHandler(async (event) => {
	try {
		const youtubeId = getRouterParam(event, "id");

		if (!youtubeId) {
			throw createError({
				statusCode: 400,
				statusMessage: "YouTube ID is required",
			});
		}

		// Define the file path for the cached song data
		const songsDir = join(process.cwd(), "server", "assets", "songs");
		const filePath = join(songsDir, `${youtubeId}.json`);

		try {
			// Read the cached song data
			const fileContent = await fs.readFile(filePath, "utf-8");
			const songData: MusicBrainzSongData = JSON.parse(fileContent);

			// Read YouTube metadata to get datetime and userId
			const metadataPath = join(
				process.cwd(),
				"server",
				"assets",
				"youtube_links_metadata.json",
			);
			let youtubeMetadata: YouTubeLinkMetadata | undefined;

			try {
				const metadataContent = await fs.readFile(metadataPath, "utf-8");
				const metadataArray: YouTubeLinkMetadata[] =
					JSON.parse(metadataContent);
				youtubeMetadata = metadataArray.find(
					(item) => item.videoId === youtubeId,
				);
			} catch (metadataError) {
				console.warn("Could not read YouTube metadata:", metadataError);
			}

			// Merge YouTube metadata with song data
			const enhancedSongData: MusicBrainzSongData = {
				...songData,
				datetime: youtubeMetadata?.datetime,
				userId: youtubeMetadata?.userId,
			};

			return {
				success: true,
				data: enhancedSongData,
				cached: true,
			} as ApiResponse<MusicBrainzSongData>;
		} catch (error) {
			// File doesn't exist or is corrupted
			throw createError({
				statusCode: 404,
				statusMessage:
					"Song metadata not found. Try searching and matching first.",
			});
		}
	} catch (error: any) {
		console.error("Error retrieving song data:", error);

		throw createError({
			statusCode: error.statusCode || 500,
			statusMessage: error.statusMessage || "Failed to retrieve song data",
		});
	}
});
