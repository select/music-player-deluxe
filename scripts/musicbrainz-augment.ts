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

// Get detailed MusicBrainz data including genres, release date, country, and external IDs
async function getMusicBrainzDetails(
	trackMbid: string,
	artistMbid: string,
): Promise<{
	genres: string[];
	artistGenres: string[];
	releaseCount: number;
	releasedAt?: string;
	artistCountry?: string;
	externalIdsTrack?: Record<string, string>;
	externalIdsArtist?: Record<string, string>;
} | null> {
	try {
		// Get recording details with genres and url-rels for track external IDs
		const recordingData = await mbApi.lookup("recording", trackMbid, [
			"releases",
			"genres",
			"url-rels",
		]);

		// Small delay between API calls to avoid rate limiting
		await sleep(200);

		// Get artist details with genres, area, and url-rels for external IDs
		const artistData = await mbApi.lookup("artist", artistMbid, [
			"genres",
			"area-rels",
			"url-rels",
		]);

		const genres =
			(recordingData as any).genres?.map((genre: any) => genre.name) || [];
		const artistGenres =
			(artistData as any).genres?.map((genre: any) => genre.name) || [];
		const releaseCount = recordingData.releases?.length || 0;

		// Get first release date
		let releasedAt: string | undefined;
		if ((recordingData as any)["first-release-date"]) {
			releasedAt = (recordingData as any)["first-release-date"];
			console.log(`   Found first release date: ${releasedAt}`);
		}

		// Get artist country (ISO 3166-1 code)
		let artistCountry: string | undefined;
		if (
			(artistData as any).area &&
			(artistData as any).area["iso-3166-1-codes"] &&
			(artistData as any).area["iso-3166-1-codes"].length > 0
		) {
			artistCountry = (artistData as any).area["iso-3166-1-codes"][0];
			console.log(
				`   Found artist country code: ${artistCountry} (${(artistData as any).area.name})`,
			);
		}

		// Extract external IDs from track URL relationships
		let externalIdsTrack: Record<string, string> | undefined;
		if (
			(recordingData as any).relations &&
			(recordingData as any).relations.length > 0
		) {
			const trackIds: Record<string, string> = {};

			for (const relation of (recordingData as any).relations) {
				if (relation.type && relation.url) {
					const url = relation.url.resource;
					const extracted = extractPlatformId(url);

					if (extracted) {
						trackIds[extracted.platform] = extracted.id;
						console.log(
							`   Found track external ID - ${extracted.platform}: ${extracted.id}`,
						);
					}
				}
			}

			if (Object.keys(trackIds).length > 0) {
				externalIdsTrack = trackIds;
			}
		}

		// Extract external IDs from artist URL relationships
		let externalIdsArtist: Record<string, string> | undefined;
		if (
			(artistData as any).relations &&
			(artistData as any).relations.length > 0
		) {
			const artistIds: Record<string, string> = {};

			for (const relation of (artistData as any).relations) {
				if (relation.type && relation.url) {
					const url = relation.url.resource;
					const extracted = extractPlatformId(url);

					if (extracted) {
						artistIds[extracted.platform] = extracted.id;
						console.log(
							`   Found artist external ID - ${extracted.platform}: ${extracted.id}`,
						);
					}
				}
			}

			if (Object.keys(artistIds).length > 0) {
				externalIdsArtist = artistIds;
			}
		}

		return {
			genres,
			artistGenres,
			releaseCount,
			releasedAt,
			artistCountry,
			externalIdsTrack,
			externalIdsArtist,
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

		// Get additional details including genres, release date, country, and external IDs
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
				releasedAt: undefined,
				artistCountry: undefined,
				externalIdsTrack: undefined,
				externalIdsArtist: undefined,
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
			releasedAt: details.releasedAt,
			artistCountry: details.artistCountry,
			externalIdsTrack: details.externalIdsTrack,
			externalIdsArtist: details.externalIdsArtist,
		};
	} catch (error) {
		console.error("MusicBrainz search error:", error);
		return null;
	}
}

// Platform ID extractors - generic patterns for extracting IDs from URLs
interface PlatformExtractor {
	pattern: string | RegExp;
	extract: (url: string) => string | null;
}

const PLATFORM_EXTRACTORS: Record<string, PlatformExtractor> = {
	spotify: {
		pattern: "open.spotify.com/",
		extract: (url) => {
			// Matches /artist/, /track/, /album/
			const match = url.match(
				/open\.spotify\.com\/(artist|track|album)\/([^/?]+)/,
			);
			return match?.[2] || null;
		},
	},
	apple: {
		pattern: "music.apple.com",
		extract: (url) => {
			// Matches artist or song IDs
			const match = url.match(/\/(artist|song|album)\/[^/]+\/(\d+)/);
			return match?.[2] || null;
		},
	},
	discogs: {
		pattern: "discogs.com/",
		extract: (url) => {
			// Matches /artist/, /release/, /master/
			const match = url.match(/discogs\.com\/(artist|release|master)\/(\d+)/);
			return match?.[2] || null;
		},
	},
	allmusic: {
		pattern: "allmusic.com/",
		extract: (url) => {
			const match = url.match(/allmusic\.com\/(artist|album|song)\/([^/?]+)/);
			return match?.[2] || null;
		},
	},
	bandcamp: {
		pattern: "bandcamp.com",
		extract: (url) => {
			// Return full URL for Bandcamp
			return url;
		},
	},
	soundcloud: {
		pattern: "soundcloud.com/",
		extract: (url) => {
			const parts = url.split("soundcloud.com/")[1];
			if (!parts) return null;
			// If it has more than one path segment, it's likely a track
			const segments = parts.split("/").filter((s) => s);
			return segments.length > 0 ? url : null;
		},
	},
	youtube: {
		pattern: "youtube.com/",
		extract: (url) => {
			if (url.includes("/channel/")) {
				return url.split("/channel/")[1]?.split("/")[0] || null;
			} else if (url.includes("/c/")) {
				return url.split("/c/")[1]?.split("/")[0] || null;
			} else if (url.includes("/@")) {
				return url.split("/@")[1]?.split("/")[0] || null;
			}
			return null;
		},
	},
	lastfm: {
		pattern: "last.fm/music/",
		extract: (url) => {
			const match = url.match(/last\.fm\/music\/([^/?]+)/);
			return match?.[1] || null;
		},
	},
	deezer: {
		pattern: "deezer.com/",
		extract: (url) => {
			const match = url.match(/deezer\.com\/(artist|track|album)\/(\d+)/);
			return match?.[2] || null;
		},
	},
	tidal: {
		pattern: "tidal.com/",
		extract: (url) => {
			const match = url.match(
				/tidal\.com\/browse\/(artist|track|album)\/(\d+)/,
			);
			return match?.[2] || null;
		},
	},
	amazonmusic: {
		pattern: "amazon.com/music/",
		extract: (url) => {
			const match = url.match(
				/amazon\.com\/music\/player\/(artists|albums|tracks)\/([^/?]+)/,
			);
			return match?.[2] || null;
		},
	},
	pandora: {
		pattern: "pandora.com/artist/",
		extract: (url) => {
			const match = url.match(/pandora\.com\/artist\/([^/?]+)/);
			return match?.[1] || null;
		},
	},
	qobuz: {
		pattern: "qobuz.com/",
		extract: (url) => {
			const match = url.match(/qobuz\.com\/(artist|album|track)\/([^/?]+)/);
			return match?.[2] || null;
		},
	},
	napster: {
		pattern: "napster.com/",
		extract: (url) => {
			const match = url.match(/napster\.com\/artist\/([^/?]+)/);
			return match?.[1] || null;
		},
	},
	musicbrainz: {
		pattern: "musicbrainz.org/",
		extract: (url) => {
			const match = url.match(
				/musicbrainz\.org\/(artist|recording|release)\/([a-f0-9-]+)/,
			);
			return match?.[2] || null;
		},
	},
	wikidata: {
		pattern: "wikidata.org/",
		extract: (url) => {
			const match = url.match(/wikidata\.org\/wiki\/(Q\d+)/);
			return match?.[1] || null;
		},
	},
	wikipedia: {
		pattern: "wikipedia.org/wiki/",
		extract: (url) => {
			const match = url.match(/wikipedia\.org\/wiki\/([^#?]+)/);
			return match?.[1] || null;
		},
	},
	genius: {
		pattern: "genius.com/",
		extract: (url) => {
			const match = url.match(/genius\.com\/(artists|songs|albums)\/([^/?]+)/);
			return match?.[2] || null;
		},
	},
	rateyourmusic: {
		pattern: "rateyourmusic.com/",
		extract: (url) => {
			const match = url.match(/rateyourmusic\.com\/(artist|release)\/([^/?]+)/);
			return match?.[2] || null;
		},
	},
};

// Extract platform ID from URL using generic extractors
function extractPlatformId(
	url: string,
): { platform: string; id: string } | null {
	for (const [platform, extractor] of Object.entries(PLATFORM_EXTRACTORS)) {
		if (url.includes(extractor.pattern as string)) {
			const id = extractor.extract(url);
			if (id) {
				return { platform, id };
			}
		}
	}
	return null;
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
				if (result.releasedAt) {
					console.log(`   Released At: ${result.releasedAt}`);
				}
				if (result.artistCountry) {
					console.log(`   Artist Country: ${result.artistCountry}`);
				}
				if (result.externalIdsTrack) {
					console.log(
						`   Track External IDs: ${Object.keys(result.externalIdsTrack).join(", ")}`,
					);
				}
				if (result.externalIdsArtist) {
					console.log(
						`   Artist External IDs: ${Object.keys(result.externalIdsArtist).join(", ")}`,
					);
				}

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
				if (result.releasedAt) {
					songMetadata.musicbrainz.releasedAt = result.releasedAt;
				}
				if (result.artistCountry) {
					songMetadata.musicbrainz.artistCountry = result.artistCountry;
				}
				if (result.externalIdsTrack) {
					songMetadata.musicbrainz.externalIdsTrack = result.externalIdsTrack;
				}
				if (result.externalIdsArtist) {
					songMetadata.musicbrainz.externalIdsArtist = result.externalIdsArtist;
				}
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
