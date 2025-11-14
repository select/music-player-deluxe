import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

interface Video {
	id: string;
	title: string;
	channel: string;
	duration: string;
	artist?: string;
	musicTitle?: string;
	tags?: string[];
	createdAt?: number;
	userId?: string | null;
}

interface Playlist {
	id: string;
	title: string;
	description: string;
	videoCount: number;
	videos: Video[];
	lastFetched: string;
}

interface ExtractedEntry {
	title: string;
	channel: string;
}

function extractMissingMetadata(): void {
	try {
		// Read the playlist file
		const playlistPath = join(
			process.cwd(),
			"public/playlist/PLHh-DPsAXiAUVUVA9DpRtiYRrwgvqg8Fx.json",
		);
		const playlistData = readFileSync(playlistPath, "utf-8");
		const playlist: Playlist = JSON.parse(playlistData);

		console.log(`Processing playlist: ${playlist.title}`);
		console.log(`Total videos: ${playlist.videos.length}`);

		// Filter videos that either:
		// 1. Don't have an artist field, OR
		// 2. Have an artist but no tags
		const missingMetadata = playlist.videos.filter((video: Video) => {
			return !video.artist || (video.artist && !video.tags);
		});

		console.log(`Found ${missingMetadata.length} videos missing metadata`);

		// Extract only title and channel
		const extractedEntries: ExtractedEntry[] = missingMetadata.map(
			(video: Video) => ({
				title: video.title,
				channel: video.channel,
			}),
		);

		// Write to output file
		const outputPath = join(process.cwd(), "extracted-missing-metadata.json");
		writeFileSync(outputPath, JSON.stringify(extractedEntries, null, 2));

		console.log(`Extracted data written to: ${outputPath}`);
		console.log("\nSample entries:");
		extractedEntries.slice(0, 5).forEach((entry, index) => {
			console.log(`${index + 1}. "${entry.title}" - ${entry.channel}`);
		});
	} catch (error) {
		console.error("Error processing playlist:", error);
		process.exit(1);
	}
}

// Run the extraction
extractMissingMetadata();
