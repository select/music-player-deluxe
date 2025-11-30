#!/usr/bin/env node

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { MusicBrainzApi } from "musicbrainz-api";
import type { Playlist, Video, SongMetaData } from "../app/types/playlist.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PLAYLIST_FILE = path.join(
	__dirname,
	"../public/playlist/PLHh-DPsAXiAUVUVA9DpRtiYRrwgvqg8Fx.json",
);
const FAIL_FILE = path.join(__dirname, "../data/musicbrainz-fail.json");
const SONGS_DIR = path.join(__dirname, "../server/assets/songs");
const RATE_LIMIT_MS = 500;

const mbApi = new MusicBrainzApi({
	appName: "MusicPlaylistView",
	appVersion: "1.0.0",
	appContactInfo: "contact@example.com",
});

interface FailData {
	failedIds: string[];
}

// Load playlist data but read only a small portion to avoid memory issues
function loadPlaylistVideos(): Video[] {
	try {
		const data = fs.readFileSync(PLAYLIST_FILE, "utf8");
		const playlist = JSON.parse(data) as Playlist;
		return playlist.videos;
	} catch (error) {
		console.error("Error loading playlist:", (error as Error).message);
		process.exit(1);
	}
}

// Load or create fail tracking file
function loadFailFile(): FailData {
	try {
		if (fs.existsSync(FAIL_FILE)) {
			const data = fs.readFileSync(FAIL_FILE, "utf8");
			return JSON.parse(data) as FailData;
		}
		return { failedIds: [] };
	} catch (error) {
		console.warn(
			"Error loading fail file, starting fresh:",
			(error as Error).message,
		);
		return { failedIds: [] };
	}
}

// Save fail tracking file
function saveFailFile(failData: FailData): void {
	try {
		fs.writeFileSync(FAIL_FILE, JSON.stringify(failData, null, 2));
	} catch (error) {
		console.error("Error saving fail file:", (error as Error).message);
	}
}

// Load song metadata file
function loadSongMetadata(youtubeId: string): SongMetaData | null {
	const songFilePath = path.join(SONGS_DIR, `${youtubeId}.json`);
	try {
		if (fs.existsSync(songFilePath)) {
			const data = fs.readFileSync(songFilePath, "utf8");
			return JSON.parse(data) as SongMetaData;
		}
		return null;
	} catch (error) {
		console.warn(
			`Error loading song metadata for ${youtubeId}:`,
			(error as Error).message,
		);
		return null;
	}
}

// Save song metadata file
function saveSongMetadata(youtubeId: string, metadata: SongMetaData): void {
	const songFilePath = path.join(SONGS_DIR, `${youtubeId}.json`);
	try {
		fs.writeFileSync(songFilePath, JSON.stringify(metadata, null, 2));
	} catch (error) {
		console.error(
			`Error saving song metadata for ${youtubeId}:`,
			(error as Error).message,
		);
	}
}

// Get detailed MusicBrainz data including genres
async function getMusicBrainzDetails(
	trackMbid: string,
	artistMbid: string,
): Promise<{
	genres: string[];
	artistGenres: string[];
	releaseCount: number;
} | null> {
	try {
		// Get recording details with genres
		const recordingData = await mbApi.lookup("recording", trackMbid, [
			"releases",
			"genres",
		]);

		// Small delay between API calls to avoid rate limiting
		await sleep(200);

		// Get artist details with genres
		const artistData = await mbApi.lookup("artist", artistMbid, ["genres"]);

		const genres =
			(recordingData as any).genres?.map((genre: any) => genre.name) || [];
		const artistGenres =
			(artistData as any).genres?.map((genre: any) => genre.name) || [];
		const releaseCount = recordingData.releases?.length || 0;

		return {
			genres,
			artistGenres,
			releaseCount,
		};
	} catch (error) {
		console.warn(
			"   Failed to fetch MusicBrainz details:",
			(error as Error).message,
		);
		return null;
	}
}

// Search MusicBrainz for exact match
async function searchMusicBrainz(
	artist: string,
	title: string,
): Promise<{
	trackMbid: string;
	artistMbid: string;
	releaseCount: number;
	genres?: string[];
	artistGenres?: string[];
} | null> {
	try {
		const searchQuery = `recording:"${title}" AND artist:"${artist}"`;

		const searchResults = await mbApi.search("recording", {
			query: searchQuery,
			limit: 10,
		});

		if (!searchResults.recordings || searchResults.recordings.length === 0) {
			console.log(`   No recordings found for "${artist} - ${title}"`);
			return null;
		}

		// Find exact match and get release counts
		const candidates: Array<{
			id: string;
			title: string;
			artist: string | undefined;
			artistMbid: string | undefined;
			releaseCount: number;
			score: number;
			exactMatch: boolean;
		} | null> = [];
		for (const recording of searchResults.recordings) {
			try {
				// Small delay between API calls to avoid rate limiting
				await sleep(200);

				// Get full recording details with releases
				const fullRecording = await mbApi.lookup("recording", recording.id, [
					"releases",
				]);

				const releaseCount = fullRecording.releases?.length || 0;
				const artistMbid = recording["artist-credit"]?.[0]?.artist?.id;

				// Check for exact match
				const recordingTitle = recording.title?.toLowerCase().trim();
				const recordingArtist = recording["artist-credit"]?.[0]?.name
					?.toLowerCase()
					.trim();
				const searchTitle = title.toLowerCase().trim();
				const searchArtist = artist.toLowerCase().trim();

				const exactMatch =
					recordingTitle === searchTitle && recordingArtist === searchArtist;

				candidates.push({
					id: recording.id,
					title: recording.title,
					artist: recording["artist-credit"]?.[0]?.name,
					artistMbid,
					releaseCount,
					score: recording.score || 0,
					exactMatch,
				});
			} catch (lookupError) {
				console.warn(
					`Failed to lookup recording ${recording.id}:`,
					lookupError,
				);
				candidates.push(null);
			}
		}

		// Filter out failed lookups and find exact matches
		const validCandidates = candidates.filter(
			(candidate) => candidate !== null,
		);
		const exactMatches = validCandidates.filter(
			(candidate) => candidate.exactMatch,
		);

		if (exactMatches.length === 0) {
			console.log(
				`   Found ${validCandidates.length} recordings but no exact matches`,
			);
			return null;
		}

		// Sort by release count (descending) then by score
		const bestMatch = exactMatches.sort((a, b) => {
			if (b.releaseCount !== a.releaseCount) {
				return b.releaseCount - a.releaseCount;
			}
			return b.score - a.score;
		})[0];

		if (!bestMatch.artistMbid) {
			console.log(`   No artist MBID found for best match: ${bestMatch.title}`);
			return null;
		}

		// Get additional details including genres
		console.log("   Fetching detailed MusicBrainz data...");
		const details = await getMusicBrainzDetails(
			bestMatch.id,
			bestMatch.artistMbid,
		);

		if (!details) {
			console.log(
				"   Warning: Failed to fetch detailed data, using basic info only",
			);
			return {
				trackMbid: bestMatch.id,
				artistMbid: bestMatch.artistMbid,
				releaseCount: bestMatch.releaseCount,
				genres: undefined,
				artistGenres: undefined,
			};
		}

		console.log(
			`   Found ${details.genres.length} track genres and ${details.artistGenres.length} artist genres`,
		);

		return {
			trackMbid: bestMatch.id,
			artistMbid: bestMatch.artistMbid,
			releaseCount: details.releaseCount,
			genres: details.genres.length > 0 ? details.genres : undefined,
			artistGenres:
				details.artistGenres.length > 0 ? details.artistGenres : undefined,
		};
	} catch (error) {
		console.error("MusicBrainz search error:", error);
		return null;
	}
}

// Sleep function for rate limiting
function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
	console.log("Starting musicbrainz-augment-search script...");
	console.log(
		`Rate limit: ${RATE_LIMIT_MS / 1000} seconds between requests (increased for genre fetching)`,
	);

	// Ensure songs directory exists
	if (!fs.existsSync(SONGS_DIR)) {
		fs.mkdirSync(SONGS_DIR, { recursive: true });
		console.log(`Created songs directory: ${SONGS_DIR}`);
	}

	// Load data
	const videos = loadPlaylistVideos();
	const failData = loadFailFile();

	console.log(`Loaded playlist with ${videos.length} videos`);
	console.log(`Found ${failData.failedIds.length} previously failed IDs`);

	// Filter videos that need MusicBrainz augmentation
	const videosToProcess: Array<{
		video: Video;
		artist: string;
		title: string;
		source: string;
	}> = [];

	for (const video of videos) {
		if (failData.failedIds.includes(video.id)) {
			continue;
		}

		// Check if video already has MusicBrainz data in song file
		const existingSongMetadata = loadSongMetadata(video.id);
		if (existingSongMetadata?.musicbrainz?.trackMbid) {
			continue;
		}

		let artist: string | undefined;
		let title: string | undefined;
		let source: string = "";

		// First try from playlist entry
		if (video.artist && video.musicTitle) {
			artist = video.artist;
			title = video.musicTitle;
			source = "playlist";
		} else {
			// Try from song metadata file with AI data
			const songMetadata = loadSongMetadata(video.id);
			if (songMetadata?.ai?.title && songMetadata?.ai?.artist) {
				artist = songMetadata.ai.artist;
				title = songMetadata.ai.title;
				source = "AI metadata";
			}
		}

		if (artist && title) {
			videosToProcess.push({
				video,
				artist,
				title,
				source,
			});
		}
	}

	console.log(`Found ${videosToProcess.length} videos to process`);

	if (videosToProcess.length === 0) {
		console.log("No videos to process. Exiting.");
		return;
	}

	let processedCount = 0;
	let successCount = 0;
	let failCount = 0;

	for (const { video, artist, title, source } of videosToProcess) {
		processedCount++;
		console.log(
			`\n[${processedCount}/${videosToProcess.length}] Processing: ${video.id}`,
		);

		console.log(`Title: ${video.title}`);
		console.log(`Extracted (${source}) - Artist: ${artist}, Title: ${title}`);

		try {
			const result = await searchMusicBrainz(artist, title);

			if (result) {
				successCount++;
				console.log("✅ Success! Found MusicBrainz match.");
				console.log(`   Track MBID: ${result.trackMbid}`);
				console.log(`   Artist MBID: ${result.artistMbid}`);
				console.log(`   Release Count: ${result.releaseCount}`);
				console.log(`   Genres: ${result.genres?.join(", ") || "None"}`);
				console.log(
					`   Artist Genres: ${result.artistGenres?.join(", ") || "None"}`,
				);

				// Load or create song metadata file
				let songMetadata = loadSongMetadata(video.id);
				if (!songMetadata) {
					songMetadata = {
						youtubeId: video.id,
						title: video.title,
						lastFetched: new Date().toISOString(),
					};
				}

				// Add MusicBrainz data to song file using new nested structure
				if (!songMetadata.musicbrainz) {
					songMetadata.musicbrainz = {};
				}
				songMetadata.musicbrainz.trackMbid = result.trackMbid;
				songMetadata.musicbrainz.artistMbid = result.artistMbid;
				songMetadata.musicbrainz.releaseCount = result.releaseCount;
				songMetadata.musicbrainz.genres = result.genres;
				songMetadata.musicbrainz.artistGenres = result.artistGenres;
				songMetadata.lastFetched = new Date().toISOString();

				// Save updated song metadata
				saveSongMetadata(video.id, songMetadata);
				console.log(`   Saved MusicBrainz data to song file ${video.id}`);
			} else {
				failCount++;
				console.log("❌ No exact match found");

				// Add to fail list
				failData.failedIds.push(video.id);
				saveFailFile(failData);
				console.log("   Added to fail list to avoid retrying");
			}
		} catch (error) {
			failCount++;
			console.log(`❌ Error: ${(error as Error).message}`);

			// Add to fail list for API errors (but not network timeouts)
			const errorMessage = (error as Error).message;
			if (
				!errorMessage.includes("timeout") &&
				!errorMessage.includes("ENOTFOUND")
			) {
				failData.failedIds.push(video.id);
				saveFailFile(failData);
				console.log("   Added to fail list to avoid retrying");
			} else {
				console.log("   Network error - will retry on next run");
			}
		}

		// Rate limiting: wait before next request (except for last item)
		if (processedCount < videosToProcess.length) {
			console.log(`⏱️  Waiting ${RATE_LIMIT_MS / 1000} seconds...`);
			await sleep(RATE_LIMIT_MS);
		}
	}

	console.log("\n=== Summary ===");
	console.log(`Total processed: ${processedCount}`);
	console.log(`Successful: ${successCount}`);
	console.log(`Failed: ${failCount}`);
	console.log(`Total failed IDs in database: ${failData.failedIds.length}`);

	if (failCount > 0) {
		console.log(`\nFailed IDs are saved in: ${FAIL_FILE}`);
	}

	console.log("\nScript completed!");
}

// Handle graceful shutdown
process.on("SIGINT", () => {
	console.log("\n\nReceived SIGINT. Gracefully shutting down...");
	process.exit(0);
});

process.on("SIGTERM", () => {
	console.log("\n\nReceived SIGTERM. Gracefully shutting down...");
	process.exit(0);
});

// Run the script
main().catch((error) => {
	console.error("Script error:", error);
	process.exit(1);
});
