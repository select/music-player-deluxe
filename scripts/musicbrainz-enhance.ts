#!/usr/bin/env node

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { MusicBrainzApi } from "musicbrainz-api";
import type { SongMetaData } from "../app/types/playlist.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SONGS_DIR = path.join(__dirname, "../server/assets/songs");
const FAIL_FILE = path.join(__dirname, "../data/musicbrainz-enhance-fail.json");
const RATE_LIMIT_MS = 1000; // Increased rate limit for more detailed API calls

const mbApi = new MusicBrainzApi({
	appName: "MusicPlaylistView",
	appVersion: "1.0.0",
	appContactInfo: "contact@example.com",
});

interface FailData {
	failedIds: string[];
}

interface EnhancedMusicBrainzData {
	releasedAt?: string; // oldest release event date
	artistCountry?: string; // artist country
	externalIdsTrack?: Record<string, string>; // external platform IDs for track
	externalIdsArtist?: Record<string, string>; // external platform IDs for artist
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

// Get enhanced MusicBrainz data for track and artist
async function getEnhancedMusicBrainzData(
	trackMbid: string,
	artistMbid: string,
): Promise<EnhancedMusicBrainzData | null> {
	try {
		console.log("   Fetching enhanced recording data...");

		// Get recording details with url-rels for track external IDs
		const recordingData = await mbApi.lookup("recording", trackMbid, [
			"url-rels",
		]);

		// Small delay between API calls
		await sleep(300);

		console.log("   Fetching enhanced artist data...");

		// Get artist details with area and url-rels for external IDs
		const artistData = await mbApi.lookup("artist", artistMbid, [
			"area-rels",
			"url-rels",
		]);

		// Small delay between API calls
		await sleep(300);

		const enhancedData: EnhancedMusicBrainzData = {};

		// Get first release date from recording
		if (recordingData["first-release-date"]) {
			enhancedData.releasedAt = recordingData["first-release-date"];
			console.log(
				`   Found first release date: ${recordingData["first-release-date"]}`,
			);
		}

		// Get artist country (ISO 3166-1 code)
		if (
			artistData.area &&
			artistData.area["iso-3166-1-codes"] &&
			artistData.area["iso-3166-1-codes"].length > 0
		) {
			enhancedData.artistCountry = artistData.area["iso-3166-1-codes"][0];
			console.log(
				`   Found artist country code: ${artistData.area["iso-3166-1-codes"][0]} (${artistData.area.name})`,
			);
		}

		// Extract external IDs from track URL relationships
		if (recordingData.relations && recordingData.relations.length > 0) {
			const externalIdsTrack: Record<string, string> = {};

			for (const relation of recordingData.relations) {
				if (relation.type && relation.url) {
					const url = relation.url.resource;
					const extracted = extractPlatformId(url);

					if (extracted) {
						externalIdsTrack[extracted.platform] = extracted.id;
						console.log(
							`   Found track external ID - ${extracted.platform}: ${extracted.id}`,
						);
					}
				}
			}

			if (Object.keys(externalIdsTrack).length > 0) {
				enhancedData.externalIdsTrack = externalIdsTrack;
			}
		}

		// Extract external IDs from artist URL relationships
		if (artistData.relations && artistData.relations.length > 0) {
			const externalIdsArtist: Record<string, string> = {};

			for (const relation of artistData.relations) {
				if (relation.type && relation.url) {
					const url = relation.url.resource;
					const extracted = extractPlatformId(url);

					if (extracted) {
						externalIdsArtist[extracted.platform] = extracted.id;
						console.log(
							`   Found artist external ID - ${extracted.platform}: ${extracted.id}`,
						);
					}
				}
			}

			if (Object.keys(externalIdsArtist).length > 0) {
				enhancedData.externalIdsArtist = externalIdsArtist;
			}
		}

		console.log("   ✅ Successfully fetched enhanced MusicBrainz data");
		return enhancedData;
	} catch (error) {
		console.warn(
			"   ❌ Failed to fetch enhanced MusicBrainz data:",
			(error as Error).message,
		);
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

// Get all song files that have MusicBrainz IDs but are missing enhanced data
function getSongsToEnhance(): string[] {
	const songFiles = fs
		.readdirSync(SONGS_DIR)
		.filter((file) => file.endsWith(".json"));
	const songsToEnhance: string[] = [];

	for (const file of songFiles) {
		const youtubeId = file.replace(".json", "");
		const metadata = loadSongMetadata(youtubeId);

		if (metadata?.musicbrainz?.trackMbid && metadata?.musicbrainz?.artistMbid) {
			// Check if already has enhanced data
			const hasReleasedAt = metadata.musicbrainz.hasOwnProperty("releasedAt");
			const hasArtistCountry =
				metadata.musicbrainz.hasOwnProperty("artistCountry");
			const hasExternalIdsTrack =
				metadata.musicbrainz.hasOwnProperty("externalIdsTrack");
			const hasExternalIdsArtist =
				metadata.musicbrainz.hasOwnProperty("externalIdsArtist");

			if (
				!hasReleasedAt ||
				!hasArtistCountry ||
				!hasExternalIdsTrack ||
				!hasExternalIdsArtist
			) {
				songsToEnhance.push(youtubeId);
			}
		}
	}

	return songsToEnhance;
}

async function main(): Promise<void> {
	console.log("Starting musicbrainz-enhance script...");
	console.log(
		"This script enhances existing songs with additional MusicBrainz data:",
	);
	console.log("- releasedAt: oldest release event date");
	console.log("- artistCountry: artist's country");
	console.log("- externalIds: external platform IDs");
	console.log(`Rate limit: ${RATE_LIMIT_MS / 1000} seconds between requests`);

	// Ensure songs directory exists
	if (!fs.existsSync(SONGS_DIR)) {
		console.error(`Songs directory not found: ${SONGS_DIR}`);
		process.exit(1);
	}

	// Load data
	const failData = loadFailFile();
	const songsToEnhance = getSongsToEnhance();

	console.log(`\nFound ${songsToEnhance.length} songs that need enhancement`);
	console.log(`Found ${failData.failedIds.length} previously failed IDs`);

	// Filter out previously failed IDs
	const filteredSongs = songsToEnhance.filter(
		(id) => !failData.failedIds.includes(id),
	);

	console.log(
		`Processing ${filteredSongs.length} songs (excluding previously failed)`,
	);

	if (filteredSongs.length === 0) {
		console.log("No songs to process. Exiting.");
		return;
	}

	let processedCount = 0;
	let successCount = 0;
	let failCount = 0;
	let skippedCount = 0;

	for (const youtubeId of filteredSongs) {
		processedCount++;
		console.log(
			`\n[${processedCount}/${filteredSongs.length}] Processing: ${youtubeId}`,
		);

		const metadata = loadSongMetadata(youtubeId);
		if (!metadata) {
			console.log("❌ Could not load song metadata");
			failCount++;
			continue;
		}

		if (!metadata.musicbrainz?.trackMbid || !metadata.musicbrainz?.artistMbid) {
			console.log("❌ Missing required MusicBrainz IDs");
			failCount++;
			continue;
		}

		console.log(`Song: ${metadata.title}`);
		console.log(`Track MBID: ${metadata.musicbrainz.trackMbid}`);
		console.log(`Artist MBID: ${metadata.musicbrainz.artistMbid}`);

		try {
			const enhancedData = await getEnhancedMusicBrainzData(
				metadata.musicbrainz.trackMbid,
				metadata.musicbrainz.artistMbid,
			);

			if (enhancedData) {
				// Merge enhanced data into existing MusicBrainz data
				if (enhancedData.releasedAt !== undefined) {
					metadata.musicbrainz.releasedAt = enhancedData.releasedAt;
				}
				if (enhancedData.artistCountry !== undefined) {
					metadata.musicbrainz.artistCountry = enhancedData.artistCountry;
				}
				if (enhancedData.externalIdsTrack !== undefined) {
					metadata.musicbrainz.externalIdsTrack = enhancedData.externalIdsTrack;
				}
				if (enhancedData.externalIdsArtist !== undefined) {
					metadata.musicbrainz.externalIdsArtist =
						enhancedData.externalIdsArtist;
				}

				// Update lastFetched timestamp
				metadata.lastFetched = new Date().toISOString();

				// Save updated metadata
				saveSongMetadata(youtubeId, metadata);

				successCount++;
				console.log("✅ Successfully enhanced song with MusicBrainz data");
			} else {
				failCount++;
				console.log("❌ Failed to get enhanced data");

				// Add to fail list
				failData.failedIds.push(youtubeId);
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
				!errorMessage.includes("ENOTFOUND") &&
				!errorMessage.includes("ECONNRESET")
			) {
				failData.failedIds.push(youtubeId);
				saveFailFile(failData);
				console.log("   Added to fail list to avoid retrying");
			} else {
				console.log("   Network error - will retry on next run");
			}
		}

		// Rate limiting: wait before next request (except for last item)
		if (processedCount < filteredSongs.length) {
			console.log(`⏱️  Waiting ${RATE_LIMIT_MS / 1000} seconds...`);
			await sleep(RATE_LIMIT_MS);
		}
	}

	console.log("\n=== Summary ===");
	console.log(`Total processed: ${processedCount}`);
	console.log(`Successfully enhanced: ${successCount}`);
	console.log(`Failed: ${failCount}`);
	console.log(`Skipped: ${skippedCount}`);
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
