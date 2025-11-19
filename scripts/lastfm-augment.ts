#!/usr/bin/env node

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PLAYLIST_FILE = path.join(
	__dirname,
	"../public/playlist/PLHh-DPsAXiAUVUVA9DpRtiYRrwgvqg8Fx.json",
);
const FAIL_FILE = path.join(__dirname, "../data/lastfm-fail.json");
const API_URL = "http://localhost:3000/api/metadata/lastfm";
const RATE_LIMIT_MS = 30000; // 30 seconds between requests (Last.fm is more lenient)

interface Video {
	id: string;
	title: string;
	artist?: string;
	channel: string;
	externalIds?: Record<string, string>;
}

interface Playlist {
	videos: Video[];
}

interface FailData {
	failedIds: string[];
}

interface LastFmAugmentResponse {
	youtubeId: string;
	artist: string;
	title: string;
	album?: string;
	duration?: number;
	tags?: string[];
	playcount?: number;
	listeners?: number;
	mbid?: string;
	lastFetched: string;
}

interface ApiResult {
	success: boolean;
	data?: LastFmAugmentResponse;
	error?: string;
}

// Load playlist data
function loadPlaylist(): Playlist {
	try {
		const data = fs.readFileSync(PLAYLIST_FILE, "utf8");
		return JSON.parse(data) as Playlist;
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

// Extract artist and title from video data
function extractArtistAndTitle(
	video: Video,
): { artist: string; title: string } | null {
	// If we already have artist and title, use them
	if (video.artist && video.title) {
		return { artist: video.artist, title: video.title };
	}

	// Try to parse from title using common patterns
	const title = video.title;

	// Common patterns: "Artist - Title", "Artist: Title", "Artist | Title"
	const patterns = [
		/^(.+?)\s*-\s*(.+)$/,
		/^(.+?)\s*:\s*(.+)$/,
		/^(.+?)\s*\|\s*(.+)$/,
		/^(.+?)\s*–\s*(.+)$/,
	];

	for (const pattern of patterns) {
		const match = title.match(pattern);
		if (match && match[1] && match[2]) {
			const artist = match[1].trim();
			const songTitle = match[2].trim();

			// Skip if it looks like it might be a video description rather than artist-title
			if (artist.length > 50 || songTitle.length > 100) {
				continue;
			}

			return { artist, title: songTitle };
		}
	}

	// If no pattern matches, try using channel as artist
	if (
		video.channel &&
		!video.channel.includes("Topic") &&
		!video.channel.includes("Records")
	) {
		return { artist: video.channel, title: video.title };
	}

	return null;
}

// Make API request
async function callLastFmAugment(
	videoId: string,
	artist: string,
	title: string,
): Promise<ApiResult> {
	try {
		const response = await fetch(API_URL, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				youtubeId: videoId,
				artist,
				title,
			}),
		});

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}

		const data = (await response.json()) as LastFmAugmentResponse;
		return { success: true, data };
	} catch (error) {
		return { success: false, error: (error as Error).message };
	}
}

// Sleep function for rate limiting
function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
	console.log("Starting lastfm-augment script...");
	console.log(`Rate limit: ${RATE_LIMIT_MS / 1000} seconds between requests`);

	// Load data
	const playlist = loadPlaylist();
	const failData = loadFailFile();

	console.log(`Loaded playlist with ${playlist.videos.length} videos`);
	console.log(`Found ${failData.failedIds.length} previously failed IDs`);

	// Filter videos that have artist/title info and not in fail list
	const videosToProcess = playlist.videos.filter((video) => {
		if (failData.failedIds.includes(video.id)) {
			return false;
		}

		// Skip videos that already have Last.fm external IDs
		if (video.externalIds?.lastfm) {
			return false;
		}

		const artistTitle = extractArtistAndTitle(video);
		return artistTitle !== null;
	});

	console.log(`Found ${videosToProcess.length} videos to process`);

	if (videosToProcess.length === 0) {
		console.log("No videos to process. Exiting.");
		return;
	}

	let processedCount = 0;
	let successCount = 0;
	let failCount = 0;

	for (const video of videosToProcess) {
		processedCount++;
		console.log(
			`\n[${processedCount}/${videosToProcess.length}] Processing: ${video.id}`,
		);

		const artistTitle = extractArtistAndTitle(video);
		if (!artistTitle) {
			console.log("❌ Could not extract artist and title");
			failCount++;
			continue;
		}

		console.log(`Title: ${video.title}`);
		console.log(
			`Extracted - Artist: ${artistTitle.artist}, Title: ${artistTitle.title}`,
		);

		const result = await callLastFmAugment(
			video.id,
			artistTitle.artist,
			artistTitle.title,
		);

		if (result.success && result.data) {
			successCount++;
			console.log("✅ Success! Last.fm metadata retrieved and saved.");

			// Log some of the found metadata for verification
			if (result.data.album) {
				console.log(`   Album: ${result.data.album}`);
			}
			if (result.data.playcount) {
				console.log(`   Play count: ${result.data.playcount.toLocaleString()}`);
			}
			if (result.data.tags && result.data.tags.length > 0) {
				console.log(
					`   Tags: ${result.data.tags.slice(0, 3).join(", ")}${result.data.tags.length > 3 ? "..." : ""}`,
				);
			}
		} else {
			failCount++;
			console.log(`❌ Failed: ${result.error}`);

			// Add to fail list if it's a 404 or other permanent error
			if (
				result.error &&
				(result.error.includes("404") ||
					result.error.includes("HTTP 4") ||
					result.error.includes("not found"))
			) {
				failData.failedIds.push(video.id);
				saveFailFile(failData);
				console.log("   Added to fail list to avoid retrying");
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
