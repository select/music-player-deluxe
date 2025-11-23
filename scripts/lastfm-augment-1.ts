#!/usr/bin/env node

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import type { Playlist, SongMetaData } from "../app/types/playlist.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PLAYLIST_FILE = path.join(
	__dirname,
	"../public/playlist/PLHh-DPsAXiAUVUVA9DpRtiYRrwgvqg8Fx.json",
);
const FAIL_FILE = path.join(__dirname, "../data/lastfm-fail.json");
const API_URL = "http://localhost:3000/api/metadata/lastfm";
const RATE_LIMIT_MS = 30000; // 30 seconds between requests (Last.fm is more lenient)

interface FailData {
	failedIds: string[];
}

interface ApiResult {
	success: boolean;
	data?: SongMetaData;
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

		const data = (await response.json()) as SongMetaData;
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

		// Check if video has required fields for processing
		return video.artist && video.musicTitle;
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

		console.log(`Title: ${video.title}`);
		console.log(
			`Extracted - Artist: ${video.artist}, Title: ${video.musicTitle}`,
		);

		const result = await callLastFmAugment(
			video.id,
			video.artist!,
			video.musicTitle!,
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
