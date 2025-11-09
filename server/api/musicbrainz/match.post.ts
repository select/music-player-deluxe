import { MusicBrainzApi } from "musicbrainz-api";
import { promises as fs } from "fs";
import { join } from "path";
import type {
	MusicBrainzMatchRequest,
	MusicBrainzSongData,
	MusicBrainzResponse,
} from "~/types";

const mbApi = new MusicBrainzApi({
	appName: "MusicPlaylistView",
	appVersion: "1.0.0",
	appContactInfo: "contact@example.com",
});

export default defineEventHandler(async (event) => {
	try {
		const body = (await readBody(event)) as MusicBrainzMatchRequest;

		if (!body.videoId || !body.selectedMbid) {
			throw createError({
				statusCode: 400,
				statusMessage: "Video ID and selected MusicBrainz ID are required",
			});
		}

		const { videoId, selectedMbid } = body;

		// Define the file path for storing the matched data
		const songsDir = join(process.cwd(), "public", "songs");
		const filePath = join(songsDir, `${videoId}.json`);

		// Fetch recording details from MusicBrainz using the API library
		const recordingData = (await mbApi.lookup("recording", selectedMbid, [
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
			mbid: selectedMbid,
			title: recordingData.title || "Unknown Title",
			artist: recordingData["artist-credit"]?.[0]?.name || "Unknown Artist",
			artistMbid: artistMbid,
			releaseCount: releaseCount,
			tags: tags,
			duration: recordingData.length
				? Math.round(recordingData.length / 1000)
				: undefined,
			youtubeId: videoId,
			lastFetched: new Date().toISOString(),
		};

		// Store the song data to file
		try {
			// Ensure the songs directory exists
			await fs.mkdir(songsDir, { recursive: true });

			// Write the song data to file
			await fs.writeFile(filePath, JSON.stringify(songData, null, 2), "utf-8");
		} catch (fileError) {
			console.warn("Failed to save song data:", fileError);
			throw createError({
				statusCode: 500,
				statusMessage: "Failed to save song metadata",
			});
		}

		return {
			success: true,
			data: songData,
			cached: false,
		} as MusicBrainzResponse;
	} catch (error: any) {
		console.error("Error matching MusicBrainz recording:", error);

		throw createError({
			statusCode: error.statusCode || 500,
			statusMessage:
				error.statusMessage || "Failed to match MusicBrainz recording",
		});
	}
});
