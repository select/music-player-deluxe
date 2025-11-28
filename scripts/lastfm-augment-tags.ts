#!/usr/bin/env node

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import * as dotenv from "dotenv";
import { Window } from "happy-dom";

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SONGS_DIR = path.join(__dirname, "../server/assets/songs");
const TAGS_FAIL_FILE = path.join(__dirname, "../data/lastfm-tags-fail.json");
const RATE_LIMIT_MS = 5000; // 1 second between requests as requested

interface SongData {
	youtubeId: string;
	title: string;
	artist: string;
	lastFetched?: string;
	lastfm?: {
		id?: string;
		title?: string;
		artist?: string;
		mbid?: string;
		artistMbid?: string;
		listeners?: number;
		playcount?: number;
		summary?: string;
		tags?: string[];
	};
	[key: string]: any;
}

// Sleep function for rate limiting
function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

// Load failed IDs from the fail tracking file
function loadFailedIds(): Set<string> {
	try {
		if (fs.existsSync(TAGS_FAIL_FILE)) {
			const data = fs.readFileSync(TAGS_FAIL_FILE, "utf8");
			const failData = JSON.parse(data);
			return new Set(failData.failedIds || []);
		}
	} catch (error) {
		console.error("Error loading failed IDs:", (error as Error).message);
	}
	return new Set();
}

// Save failed IDs to the fail tracking file
function saveFailedIds(failedIds: Set<string>): boolean {
	try {
		const failData = {
			failedIds: Array.from(failedIds).sort(),
		};
		fs.writeFileSync(TAGS_FAIL_FILE, JSON.stringify(failData, null, 2));
		return true;
	} catch (error) {
		console.error("Error saving failed IDs:", (error as Error).message);
		return false;
	}
}

// Load song data from JSON file
function loadSongData(filePath: string): SongData | null {
	try {
		const data = fs.readFileSync(filePath, "utf8");
		return JSON.parse(data) as SongData;
	} catch (error) {
		console.error(`Error loading ${filePath}:`, (error as Error).message);
		return null;
	}
}

// Save song data to JSON file
function saveSongData(filePath: string, data: SongData): boolean {
	try {
		fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
		return true;
	} catch (error) {
		console.error(`Error saving ${filePath}:`, (error as Error).message);
		return false;
	}
}

// Get all JSON files in songs directory
function getSongFiles(): string[] {
	try {
		const files = fs.readdirSync(SONGS_DIR);
		return files
			.filter((file) => file.endsWith(".json"))
			.map((file) => path.join(SONGS_DIR, file));
	} catch (error) {
		console.error("Error reading songs directory:", (error as Error).message);
		return [];
	}
}

// Check if song needs tag augmentation
function needsTagAugmentation(
	songData: SongData,
	failedIds: Set<string>,
): boolean {
	// Must have lastfm.id but not lastfm.tags, and not be in failed list
	return !!(
		songData.lastfm?.id &&
		!songData.lastfm?.tags &&
		!failedIds.has(songData.lastfm.id)
	);
}

// Get Last.fm tags by scraping the webpage
async function getLastFmTags(lastfmId: string): Promise<string[]> {
	console.log(`    Fetching tags from Last.fm page: ${lastfmId}`);
	const url = `https://www.last.fm/music/${lastfmId}`;

	const response = await fetch(url, {
		headers: {
			"User-Agent":
				"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
		},
	});

	if (!response.ok) {
		console.log(`    HTTP error: ${response.status}`);
		throw new Error(`HTTP ${response.status}: Network error`);
	}

	const html = await response.text();

	// Parse HTML with happy-dom using a safer approach
	const window = new Window({
		url: url,
		settings: {
			disableCSSFileLoading: true,
			disableJavaScriptFileLoading: true,
			disableJavaScriptEvaluation: true,
			disableErrorCapturing: true,
		},
	});

	const document = window.document;

	// Create a temporary div to safely parse just the HTML fragment we need
	const tempDiv = document.createElement("div");
	tempDiv.innerHTML = html;

	// Find the tags list ul element
	const tagsUl = tempDiv.querySelector("ul.tags-list.tags-list--global");

	if (!tagsUl) {
		console.log(`    No tags section found`);
		window.close();
		throw new Error("No tags section found - should be added to fail list");
	}

	// Extract tags from li elements
	const tagElements = tagsUl.querySelectorAll("li.tag a");
	const tags: string[] = [];

	for (const tagElement of tagElements) {
		const tagText = tagElement.textContent?.trim();
		if (tagText) {
			tags.push(tagText);
		}
	}

	if (tags.length > 0) {
		console.log(
			`    Found ${tags.length} tags: ${tags.slice(0, 5).join(", ")}${tags.length > 5 ? "..." : ""}`,
		);
	} else {
		console.log(`    No tags found`);
		window.close();
		throw new Error("No tags found - should be added to fail list");
	}

	// Clean up the DOM
	window.close();

	return tags;
}

async function main(): Promise<void> {
	console.log("Starting Last.fm tag augmentation script...");
	console.log(`Rate limit: ${RATE_LIMIT_MS / 1000} second(s) between requests`);

	console.log("✅ Using direct Last.fm webpage scraping");

	// Load failed IDs
	const failedIds = loadFailedIds();
	console.log(`Loaded ${failedIds.size} previously failed IDs`);

	// Get all song files
	const songFiles = getSongFiles();
	console.log(`Found ${songFiles.length} song files`);

	if (songFiles.length === 0) {
		console.log("No song files found. Exiting.");
		return;
	}

	// Filter files that need tag augmentation
	const filesToProcess: { file: string; data: SongData }[] = [];

	for (const file of songFiles) {
		const songData = loadSongData(file);
		if (songData && needsTagAugmentation(songData, failedIds)) {
			filesToProcess.push({ file, data: songData });
		}
	}

	console.log(
		`Found ${filesToProcess.length} files that need tag augmentation`,
	);

	if (filesToProcess.length === 0) {
		console.log("No files need tag augmentation. Exiting.");
		return;
	}

	let processedCount = 0;
	let successCount = 0;
	let failCount = 0;
	let newFailedIds = 0;

	for (const { file, data } of filesToProcess) {
		processedCount++;
		const fileName = path.basename(file);

		console.log(
			`\n[${processedCount}/${filesToProcess.length}] Processing: ${fileName}`,
		);
		console.log(`  Title: ${data.title}`);
		console.log(`  Artist: ${data.artist}`);
		console.log(`  Last.fm ID: ${data.lastfm?.id}`);

		try {
			const lastfmId = data.lastfm!.id!;
			const tags = await getLastFmTags(lastfmId);

			// Add tags to the lastfm object
			data.lastfm!.tags = tags;

			// Save updated data
			if (saveSongData(file, data)) {
				successCount++;
				console.log(`  ✅ Success! Added ${tags.length} tags`);
			} else {
				failCount++;
				console.log(`  ❌ Failed to save file`);
			}
		} catch (error) {
			failCount++;
			const errorMessage = (error as Error).message;
			const lastfmId = data.lastfm!.id!;

			// Only add to fail list if it's a "no tags found" error, not network errors
			if (errorMessage.includes("should be added to fail list")) {
				failedIds.add(lastfmId);
				newFailedIds++;
				console.log(
					`  ❌ Failed: ${errorMessage.replace(" - should be added to fail list", "")}, added to failed list`,
				);
				// Save failed IDs immediately
				saveFailedIds(failedIds);
			} else {
				console.log(
					`  ❌ Failed: ${errorMessage} (not added to fail list - may be temporary)`,
				);
			}
		}

		// Rate limiting: wait before next request (except for last item)
		if (processedCount < filesToProcess.length) {
			console.log(`  ⏱️  Waiting ${RATE_LIMIT_MS / 1000} second(s)...`);
			await sleep(RATE_LIMIT_MS);
		}
	}

	// Final summary of failed IDs (already saved individually)
	if (newFailedIds > 0) {
		console.log(
			`\n💾 ${newFailedIds} new failed IDs were saved to ${TAGS_FAIL_FILE}`,
		);
	}

	console.log("\n=== Summary ===");
	console.log(`Total processed: ${processedCount}`);
	console.log(`Successful: ${successCount}`);
	console.log(`Failed: ${failCount}`);
	console.log(`New failed IDs: ${newFailedIds}`);
	console.log(`Total failed IDs: ${failedIds.size}`);
	console.log(
		`Success rate: ${processedCount > 0 ? ((successCount / processedCount) * 100).toFixed(1) : 0}%`,
	);

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
