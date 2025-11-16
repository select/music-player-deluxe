import { promises as fs } from "fs";
import { join } from "path";
import type { SongMetaData, YouTubeLinkMetadata } from "~/types";

export default defineEventHandler(async () => {
	try {
		const songsDir = join(process.cwd(), "server", "assets", "songs");
		const metadataPath = join(
			process.cwd(),
			"data",
			"anonymized-metadata.json",
		);

		// Read YouTube metadata once
		let youtubeMetadataArray: YouTubeLinkMetadata[] = [];
		try {
			const metadataContent = await fs.readFile(metadataPath, "utf-8");
			youtubeMetadataArray = JSON.parse(metadataContent);
		} catch (metadataError) {
			console.warn("Could not read YouTube metadata:", metadataError);
		}

		// Read all JSON files in the songs directory
		let files: string[] = [];
		try {
			const allFiles = await fs.readdir(songsDir);
			files = allFiles.filter((file) => file.endsWith(".json"));
		} catch (dirError) {
			console.warn("Could not read songs directory:", dirError);
			return {};
		}

		// Process each file
		const results: Record<string, SongMetaData> = {};

		for (const fileName of files) {
			const youtubeId = fileName.replace(".json", "");
			const filePath = join(songsDir, fileName);

			try {
				// Read the cached song data
				const fileContent = await fs.readFile(filePath, "utf-8");
				const songData: SongMetaData = JSON.parse(fileContent);

				// Find corresponding YouTube metadata
				const youtubeMetadata = youtubeMetadataArray.find(
					(item) => item.videoId === youtubeId,
				);

				// Merge YouTube metadata with song data
				const enhancedSongData: SongMetaData = {
					...songData,
					datetime: youtubeMetadata?.datetime,
					userId: youtubeMetadata?.userId,
				};

				results[youtubeId] = enhancedSongData;
			} catch (error) {
				// File doesn't exist or is corrupted, skip this file
				console.warn(`Could not process file ${fileName}:`, error);
			}
		}

		return results;
	} catch (error: any) {
		console.error("Error retrieving all song metadata:", error);

		throw createError({
			statusCode: error.statusCode || 500,
			statusMessage: error.statusMessage || "Failed to retrieve song metadata",
		});
	}
});
