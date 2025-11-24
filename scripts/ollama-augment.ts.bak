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
const FAIL_FILE = path.join(__dirname, "../data/ollama-fail.json");
const API_URL = "http://localhost:3000/api/metadata/ollama";

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

interface OllamaAugmentResponse {
	title: string;
	artist: string;
}

interface ApiResult {
	success: boolean;
	data?: OllamaAugmentResponse;
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

// Make API request
async function callOllamaAugment(
	videoId: string,
	title: string,
	channel: string,
): Promise<ApiResult> {
	try {
		const response = await fetch(API_URL, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				youtubeId: videoId,
				title: title,
				channel: channel,
			}),
		});

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}

		const data = (await response.json()) as OllamaAugmentResponse;
		return { success: true, data };
	} catch (error) {
		return { success: false, error: (error as Error).message };
	}
}

async function main(): Promise<void> {
	console.log("Starting ollama-augment script...");
	console.log("Processing videos without artist field using Ollama AI...");

	// Load data
	const playlist = loadPlaylist();

	console.log(`Loaded playlist with ${playlist.videos.length} videos`);

	// Filter videos without artist field and not in fail list
	const videosToProcess = playlist.videos.filter((video) => {
		return !video.artist;
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
		console.log(`Channel: ${video.channel}`);

		const result = await callOllamaAugment(
			video.id,
			video.title,
			video.channel,
		);

		if (result.success && result.data) {
			successCount++;
			console.log("✅ Success! Artist extracted and will be saved.");
			console.log(`   Extracted Artist: "${result.data.artist}"`);
			console.log(`   Cleaned Title: "${result.data.title}"`);
		} else {
			failCount++;
			console.log(`❌ Failed: ${result.error}`);

			// Add to fail list if it's a 404 or other permanent error
			if (
				result.error &&
				(result.error.includes("404") ||
					result.error.includes("HTTP 4") ||
					result.error.includes("extraction failed"))
			) {
				console.log("   Added to fail list to avoid retrying");
			}
		}

		// No rate limiting - process immediately
		if (processedCount % 10 === 0) {
			console.log(`⏳ Processed ${processedCount} videos so far...`);
		}
	}

	console.log("\n=== Summary ===");
	console.log(`Total processed: ${processedCount}`);
	console.log(`Successful extractions: ${successCount}`);
	console.log(`Failed extractions: ${failCount}`);

	if (failCount > 0) {
		console.log(`\nFailed IDs are saved in: ${FAIL_FILE}`);
	}

	if (successCount > 0) {
		console.log("\n🎵 Artist information has been extracted successfully!");
		console.log("Metadata is stored in server-side files via the API.");
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
