import { MusicBrainzApi } from "musicbrainz-api";
import type { MusicBrainzSearchResult, SearchResponse } from "~/types";

const mbApi = new MusicBrainzApi({
	appName: "MusicPlaylistView",
	appVersion: "1.0.0",
	appContactInfo: "contact@example.com",
});

interface DirectSearchRequest {
	artist: string;
	title: string;
}

export default defineEventHandler(async (event) => {
	try {
		const body = (await readBody(event)) as DirectSearchRequest;

		if (!body.artist || !body.title) {
			throw createError({
				statusCode: 400,
				statusMessage: "Artist and title are required",
			});
		}

		const { artist, title } = body;

		// Search MusicBrainz with the provided artist and title
		const searchQuery = `recording:"${title}" AND artist:"${artist}"`;

		const searchResults = await mbApi.search("recording", {
			query: searchQuery,
			limit: 10,
		});

		if (!searchResults.recordings) {
			return {
				success: true,
				results: [],
				query: `${artist} - ${title}`,
			} as SearchResponse;
		}

		// Get detailed recording info with releases for each result
		const results: MusicBrainzSearchResult[] = await Promise.all(
			searchResults.recordings.map(async (recording: any) => {
				try {
					// Get full recording details with releases
					const fullRecording = await mbApi.lookup("recording", recording.id, [
						"releases",
					]);

					const releaseCount = fullRecording.releases?.length || 0;

					return {
						id: recording.id,
						title: recording.title,
						artist: recording["artist-credit"]?.[0]?.name || "Unknown Artist",
						releaseCount,
						score: recording.score || 0,
						disambiguation: recording.disambiguation,
					};
				} catch (lookupError) {
					console.warn(
						`Failed to lookup recording ${recording.id}:`,
						lookupError,
					);
					// Return basic info without release count if lookup fails
					return {
						id: recording.id,
						title: recording.title,
						artist: recording["artist-credit"]?.[0]?.name || "Unknown Artist",
						releaseCount: 0,
						score: recording.score || 0,
						disambiguation: recording.disambiguation,
					};
				}
			}),
		);

		// Sort by release count (descending) then by score, and filter by minimum score
		const filteredResults = results
			.sort((a, b) => {
				// Primary sort: release count (descending)
				if (b.releaseCount !== a.releaseCount) {
					return b.releaseCount - a.releaseCount;
				}
				// Secondary sort: score (descending)
				return b.score - a.score;
			})
			.filter((result) => result.score >= 60);

		return {
			success: true,
			results: filteredResults,
			query: `${artist} - ${title}`,
		} as SearchResponse;
	} catch (error: any) {
		console.error("Error searching MusicBrainz:", error);

		throw createError({
			statusCode: error.statusCode || 500,
			statusMessage: error.statusMessage || "Failed to search MusicBrainz",
		});
	}
});
