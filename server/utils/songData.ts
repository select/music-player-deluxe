import { promises as fs } from "fs";
import { join } from "path";
import type { SongMetaData } from "~/types";

/**
 * Gets the file path for a song's metadata file
 * @param youtubeId - The YouTube video ID
 * @returns The full file path
 */
export function getSongDataFilePath(youtubeId: string): string {
	const songsDir = join(process.cwd(), "server", "assets", "songs");
	return join(songsDir, `${youtubeId}.json`);
}

/**
 * Reads existing song data from file or creates empty object
 * @param youtubeId - The YouTube video ID
 * @returns Promise that resolves to song metadata
 */
export async function getSongData(youtubeId: string): Promise<SongMetaData> {
	const filePath = getSongDataFilePath(youtubeId);

	try {
		const fileContent = await fs.readFile(filePath, "utf-8");
		return JSON.parse(fileContent);
	} catch (_error) {
		// Create empty song data object if file doesn't exist
		return {
			youtubeId,
			title: "",
			artist: "",
			lastFetched: new Date().toISOString(),
		};
	}
}

/**
 * Updates and saves song data to file
 * @param songData - The song metadata to save
 * @returns Promise that resolves when file is saved
 */
export async function updateSongData(songData: SongMetaData): Promise<void> {
	const filePath = getSongDataFilePath(songData.youtubeId);
	const songsDir = join(process.cwd(), "server", "assets", "songs");

	// Ensure directory exists
	await fs.mkdir(songsDir, { recursive: true });

	// Update last fetched timestamp
	songData.lastFetched = new Date().toISOString();

	// Save the file
	await fs.writeFile(filePath, JSON.stringify(songData, null, 2), "utf-8");
}

/**
 * Checks if data is recent (less than specified days old)
 * @param lastFetched - ISO string of when data was last fetched
 * @param maxAgeDays - Maximum age in days (default: 7)
 * @returns True if data is recent, false otherwise
 */
export function isDataRecent(
	lastFetched: string,
	maxAgeDays: number = 7,
): boolean {
	const lastFetchedDate = new Date(lastFetched);
	const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
	return Date.now() - lastFetchedDate.getTime() < maxAgeMs;
}
