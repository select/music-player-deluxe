import { promises as fs } from "fs";
import { join } from "path";
import type { SongMetaData } from "~/types";

interface CurateRequest {
	youtubeId: string;
	artist: string;
	title: string;
}

export default defineEventHandler(async (event) => {
	try {
		const body = await readBody<CurateRequest>(event);
		const { youtubeId, artist, title } = body;

		if (!youtubeId || !artist || !title) {
			throw createError({
				statusCode: 400,
				statusMessage: "Missing required fields: youtubeId, artist, title",
			});
		}

		const songsDir = join(process.cwd(), "server", "assets", "songs");
		const filePath = join(songsDir, `${youtubeId}.json`);

		let songData: SongMetaData;

		// Try to read existing file
		try {
			const fileContent = await fs.readFile(filePath, "utf-8");
			songData = JSON.parse(fileContent);
		} catch (error) {
			// File doesn't exist, create new one
			songData = {
				youtubeId,
				title: `${artist} - ${title}`,
				lastFetched: new Date().toISOString(),
			};
		}

		// Update with curated data
		songData.curated = {
			artist,
			title,
		};

		// Update lastFetched
		songData.lastFetched = new Date().toISOString();

		// Write back to file
		await fs.writeFile(filePath, JSON.stringify(songData, null, 2), "utf-8");

		return {
			success: true,
			message: "Song metadata curated successfully",
			data: songData,
		};
	} catch (error: any) {
		console.error("Error curating song metadata:", error);

		throw createError({
			statusCode: error.statusCode || 500,
			statusMessage: error.statusMessage || "Failed to curate song metadata",
		});
	}
});
