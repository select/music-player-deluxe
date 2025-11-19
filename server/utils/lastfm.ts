import LastFM from "./lastfm-lib";
import type { ParsedTrack, LastFMTrackInfo } from "./lastfm-lib";

// TypeScript interfaces for Last.fm data transformation
export interface LastfmTrackData {
	name?: string;
	mbid?: string;
	lastfmId?: string;
	listeners?: string;
	playcount?: string;
	artist?: string;
	artistMbid?: string;
	lastfmTags?: string[];
	lastfmSummary?: string;
}

export interface LastfmResult {
	success: true;
	data: LastfmTrackData;
}

export interface LastfmError {
	success: false;
	error: string;
}

export type LastfmResponse = LastfmResult | LastfmError;

// Initialize Last.fm client
// You'll need to set LASTFM_API_KEY in your .env file
let lastfm: LastFM | null = null;

try {
	if (!process.env.LASTFM_API_KEY) {
		throw new Error("LASTFM_API_KEY environment variable is not set");
	}
	lastfm = new LastFM(process.env.LASTFM_API_KEY, {
		userAgent: "MusicPlayerDeluxe/1.0.0",
		minTrackListeners: 0,
	});
} catch (error) {
	console.error("❌ Last.fm API initialization failed:", error);
	console.log("💡 Make sure to set your LASTFM_API_KEY in the .env file");
	console.log(
		"   You can get an API key from: https://www.last.fm/api/account/create",
	);
}

/**
 * Search for tracks on Last.fm using artist and music title
 * @param artist - The artist name
 * @param musicTitle - The track title
 * @returns Promise with Last.fm search results
 */
export async function searchTrack(artist: string, musicTitle: string) {
	if (!lastfm) {
		throw new Error(
			"Last.fm API client is not initialized. Please check your LASTFM_API_KEY environment variable.",
		);
	}

	try {
		return await lastfm.trackSearch({
			track: musicTitle,
			artist,
			limit: 10,
		});
	} catch (error) {
		throw new Error(
			`Last.fm API error: ${error instanceof Error ? error.message : error}`,
		);
	}
}

/**
 * Get detailed track information from Last.fm
 * @param artist - The artist name
 * @param track - The track name
 * @returns Promise with track info
 */
export async function getTrackInfo(artist: string, track: string) {
	if (!lastfm) {
		throw new Error(
			"Last.fm API client is not initialized. Please check your LASTFM_API_KEY environment variable.",
		);
	}

	return await lastfm.trackInfo({
		artistName: artist,
		track: track,
	});
}

/**
 * Search for artists on Last.fm
 * @param artistName - The artist name to search for
 * @returns Promise with artist search results
 */
export async function searchArtist(artistName: string) {
	if (!lastfm) {
		throw new Error(
			"Last.fm API client is not initialized. Please check your LASTFM_API_KEY environment variable.",
		);
	}

	try {
		return await lastfm.artistSearch({
			artist: artistName,
			limit: 10,
		});
	} catch (error) {
		throw new Error(
			`Last.fm API error: ${error instanceof Error ? error.message : error}`,
		);
	}
}

/**
 * Helper function to get the best matching track from search results
 * @param searchResults - The search results from searchTrack
 * @param originalArtist - The original artist name for comparison
 * @param originalTitle - The original track title for comparison
 * @returns The best matching track or null if no good match found
 */
export function getBestTrackMatch(searchResults: ParsedTrack[]) {
	if (searchResults.length === 0) {
		return null;
	}

	// Sort by listeners (popularity) and return the most popular match
	const sortedResults = searchResults
		.filter((track) => track.type === "track")
		.sort((a, b) => (b.listeners ?? 0) - (a.listeners ?? 0));

	return sortedResults[0] || null;
}

/**
 * Extract Last.fm ID from URL
 * @param url - Last.fm track URL
 * @returns Last.fm ID in format "Artist/_/Track"
 */
export function extractLastfmId(url: string): string {
	// Extract the part after /music/
	const match = url.match(/\/music\/(.+)$/);
	return match?.[1] || "";
}

/**
 * Transform Last.fm track info into our normalized format
 * @param trackInfo - Raw Last.fm track info
 * @returns Normalized Last.fm data
 */
export function transformLastfmData(trackInfo: LastFMTrackInfo) {
	const lastfmId = trackInfo.url ? extractLastfmId(trackInfo.url) : "";
	const tags = trackInfo.toptags?.tag?.map((tag) => tag.name) || [];

	return {
		title: trackInfo.name,
		mbid: trackInfo.mbid,
		lastfmId: lastfmId || undefined,
		listeners: trackInfo.listeners ? parseInt(trackInfo.listeners) : undefined,
		playcount: trackInfo.playcount ? parseInt(trackInfo.playcount) : undefined,
		artist: trackInfo.artist?.name,
		artistMbid: trackInfo.artist?.mbid,
		lastfmTags: tags.length > 0 ? tags : undefined,
		lastfmSummary: trackInfo.wiki?.summary,
	};
}
