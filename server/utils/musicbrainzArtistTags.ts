import { MusicBrainzApi } from "musicbrainz-api";
import { promises as fs } from "fs";
import { join } from "path";
import type { SongMetaData } from "~/types";

const mbApi = new MusicBrainzApi({
	appName: "MusicPlaylistView",
	appVersion: "1.0.0",
	appContactInfo: "contact@example.com",
});

/**
 * Fetches artist tags for a song using its MusicBrainz ID (mbid)
 * @param songMbid - The MusicBrainz recording ID of the song
 * @returns Array of artist tag strings, or empty array if not found/no tags
 */
export async function getMusicBrainzArtistTags(
	songMbid: string,
): Promise<string[]> {
	try {
		if (!songMbid) {
			return [];
		}

		// Define the file path for the song data
		const songsDir = join(process.cwd(), "server", "assets", "songs");

		// Find the JSON file that contains this mbid
		let songData: SongMetaData | null = null;
		let filePath: string | null = null;

		try {
			const songFiles = await fs.readdir(songsDir);

			for (const songFile of songFiles) {
				if (songFile.endsWith(".json")) {
					const currentFilePath = join(songsDir, songFile);
					try {
						const fileContent = await fs.readFile(currentFilePath, "utf-8");
						const currentSongData: SongMetaData = JSON.parse(fileContent);

						if (currentSongData.mbid === songMbid) {
							songData = currentSongData;
							filePath = currentFilePath;
							break;
						}
					} catch {
						// Skip malformed JSON files
						continue;
					}
				}
			}
		} catch {
			// Songs directory doesn't exist or can't be read
			return [];
		}

		if (!songData || !filePath) {
			// Song data not found for this mbid
			return [];
		}

		// Check if artist tags already exist and are recent (less than 30 days old)
		if (songData.artistTags && songData.artistTags.length > 0) {
			const lastFetched = new Date(songData.lastFetched);
			const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

			if (lastFetched.getTime() > thirtyDaysAgo) {
				return songData.artistTags;
			}
		}

		// Use stored artistMbid if available, otherwise fetch from recording data
		let artistMbid = songData.artistMbid;

		if (!artistMbid) {
			// Fallback: get the recording data to extract artist MBID
			try {
				const recordingData = (await mbApi.lookup("recording", songData.mbid, [
					"artist-credits",
				])) as any;

				if (
					recordingData &&
					recordingData["artist-credit"] &&
					recordingData["artist-credit"].length > 0
				) {
					// Get the primary artist MBID from the recording
					artistMbid = recordingData["artist-credit"][0].artist.id;

					if (artistMbid) {
						// Store the artistMbid for future use
						songData.artistMbid = artistMbid;
					}
				}
			} catch {
				// Failed to fetch recording data
				return [];
			}
		}

		if (!artistMbid) {
			return [];
		}

		// Fetch artist details with tags using the MBID from the recording
		try {
			const artistData = (await mbApi.lookup("artist", artistMbid, [
				"tags",
			])) as any;

			// Extract artist tags
			const artistTags = artistData.tags?.map((tag: any) => tag.name) || [];

			// Update song data with artist tags
			songData.artistTags = artistTags;
			songData.lastFetched = new Date().toISOString();

			// Save updated song data back to file
			try {
				await fs.writeFile(
					filePath,
					JSON.stringify(songData, null, 2),
					"utf-8",
				);
			} catch {
				// Failed to save updated data, but still return the tags
				console.warn(
					`Failed to update song data with artist tags for mbid: ${songMbid}`,
				);
			}

			return artistTags;
		} catch {
			// Failed to fetch artist data
			return [];
		}
	} catch (error) {
		console.error("Error fetching artist tags for mbid:", songMbid, error);
		return [];
	}
}
