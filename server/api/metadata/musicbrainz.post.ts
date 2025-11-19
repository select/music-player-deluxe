import { MusicBrainzApi } from "musicbrainz-api";
import type {
	MusicBrainzMatchRequest,
	SongMetaData,
	MusicBrainzResponse,
} from "~/types";
import { getSongData, updateSongData } from "../../utils/songData";

const mbApi = new MusicBrainzApi({
	appName: "MusicPlaylistView",
	appVersion: "1.0.0",
	appContactInfo: "contact@example.com",
});

export default defineEventHandler(async (event) => {
	try {
		const body = (await readBody(event)) as MusicBrainzMatchRequest;

		if (!body.videoId || !body.mbid) {
			throw createError({
				statusCode: 400,
				statusMessage: "Video ID and selected MusicBrainz ID are required",
			});
		}

		const { videoId, mbid } = body;

		// Get existing song data
		const existingSongData = await getSongData(videoId);

		// Fetch recording details from MusicBrainz using the API library
		const recordingData = (await mbApi.lookup("recording", mbid, [
			"artist-credits",
			"releases",
			"tags",
			"genres",
		])) as any;

		if (!recordingData) {
			throw createError({
				statusCode: 404,
				statusMessage: "Recording not found in MusicBrainz",
			});
		}

		// Extract tags and genres separately
		const tags = recordingData.tags?.map((tag: any) => tag.name) || [];
		const genres = recordingData.genres?.map((genre: any) => genre.name) || [];

		// Count total releases
		const releaseCount = recordingData.releases?.length || 0;

		// Extract artist MBID
		const artistMbid = recordingData["artist-credit"]?.[0]?.artist?.id;

		// Merge MusicBrainz data with existing song data
		const updatedSongData: SongMetaData = {
			// Keep existing data
			...existingSongData,
			// Update with MusicBrainz data
			mbid: mbid,
			title: existingSongData.title || recordingData.title || "Unknown Title",
			artist:
				existingSongData.artist ||
				recordingData["artist-credit"]?.[0]?.name ||
				"Unknown Artist",
			artistMbid: artistMbid,
			releaseCount: releaseCount,
			tags: tags.length > 0 ? tags : existingSongData.tags,
			genres: genres.length > 0 ? genres : existingSongData.genres,
			duration: recordingData.length
				? Math.round(recordingData.length / 1000)
				: existingSongData.duration,
			youtubeId: videoId,
		};

		// Save the updated song data
		try {
			await updateSongData(updatedSongData);
		} catch (fileError) {
			console.warn("Failed to save song data:", fileError);
			throw createError({
				statusCode: 500,
				statusMessage: "Failed to save song metadata",
			});
		}

		return {
			success: true,
			data: updatedSongData,
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
