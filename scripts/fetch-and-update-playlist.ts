/**
 * Fetch and Update Playlist Script
 *
 * This script performs two main operations:
 * 1. Fetches a YouTube playlist using youtubei and saves it to public/playlist/
 * 2. Updates the playlist with all available metadata from:
 *    - Song data (server/assets/songs/*.json) - MusicBrainz, Last.fm, Odesli data
 *    - YouTube metadata (data/anonymized-metadata.json) - upload dates, user IDs
 *    - Tag normalization and blacklist filtering
 *
 * Usage:
 *   pnpm playlist:fetch-update
 *
 * Configuration:
 *   - Modify PLAYLIST_ID constant below to fetch a different playlist
 */

import { promises as fs } from "fs";
import { join } from "path";
import {
	createYouTubeClient,
	fetchPlaylistVideos,
	type NormalizedPlaylist,
} from "../app/utils/youtube.js";
import type {
	Video,
	Playlist,
	PlaylistSummary,
	SongMetaData,
	YouTubeLinkMetadata,
} from "../app/types/index.js";

interface TagBlacklistData {
	blacklistedTags: string[];
}

interface TagNormalizationData {
	mappings: Record<string, string>;
}

// The playlist ID to fetch and update
const PLAYLIST_ID = "PLHh-DPsAXiAUVUVA9DpRtiYRrwgvqg8Fx";

// Helper function to update the index file with playlist summaries
async function updateIndexFile(
	playlistsDir: string,
	newPlaylistData: Playlist,
): Promise<void> {
	try {
		const indexFilePath = join(process.cwd(), "public", "index.json");

		// Read existing index or create empty array
		let index: PlaylistSummary[] = [];
		try {
			const indexContent = await fs.readFile(indexFilePath, "utf-8");
			const parsed = JSON.parse(indexContent);
			// Handle both array format and { success, data: [...] } wrapper format
			if (Array.isArray(parsed)) {
				index = parsed;
			} else if (parsed && Array.isArray(parsed.data)) {
				index = parsed.data;
			} else {
				index = [];
			}
		} catch (error) {
			// File doesn't exist or is invalid, start with empty array
			index = [];
		}

		// Create playlist summary for index
		const playlistSummary: PlaylistSummary = {
			id: newPlaylistData.id,
			title: newPlaylistData.title,
			description: newPlaylistData.description,
			videoCount: newPlaylistData.videoCount,
			lastFetched: newPlaylistData.lastFetched,
			fileName: `${newPlaylistData.id}.json`,
		};

		// Remove existing entry if it exists
		index = index.filter((item) => item.id !== newPlaylistData.id);

		// Add new entry
		index.push(playlistSummary);

		// Sort by lastFetched (newest first)
		index.sort(
			(a, b) =>
				new Date(b.lastFetched).getTime() - new Date(a.lastFetched).getTime(),
		);

		// Write updated index
		await fs.writeFile(
			indexFilePath,
			JSON.stringify(
				{
					success: true,
					data: index,
					count: index.length,
					lastUpdated: new Date().toISOString(),
				},
				null,
				2,
			),
			"utf-8",
		);
	} catch (error) {
		console.warn("Failed to update index file:", error);
	}
}

// --- youtubei.js playlist fetching lives in app/utils/youtube.ts (shared) ---


// Step 1: Fetch the playlist from YouTube
async function fetchPlaylist(playlistId: string): Promise<Playlist> {
	console.log(`\n=== Step 1: Fetching playlist ${playlistId} ===`);

	// Define the file path for caching
	const playlistsDir = join(process.cwd(), "public", "playlist");
	const filePath = join(playlistsDir, `${playlistId}.json`);

	const FETCH_RETRIES = 3;
	const FETCH_RETRY_DELAY = 15000; // 15s between full-fetch retries (rate limit cooldown)

	let videos: Video[] = [];
	let normalized: NormalizedPlaylist = {
		id: playlistId,
		title: "",
		description: "",
		videoCount: 0,
		videos: [],
	};

	for (let attempt = 1; attempt <= FETCH_RETRIES; attempt++) {
		if (attempt > 1) {
			console.warn(`\n  ⏳ Waiting ${FETCH_RETRY_DELAY / 1000}s before retry ${attempt}/${FETCH_RETRIES} (rate limit cooldown)...`);
			await new Promise(resolve => setTimeout(resolve, FETCH_RETRY_DELAY));
		}

		// Initialize a fresh YouTube (InnerTube) client each attempt
		console.log(`Initializing YouTube client (attempt ${attempt}/${FETCH_RETRIES})...`);
		const youtube = await createYouTubeClient();

		// Fetch playlist metadata and all video entries (via continuation)
		console.log("Loading all videos (this may take a moment)...");
		try {
			normalized = await fetchPlaylistVideos(youtube, playlistId, (count) =>
				console.log(`  Loaded ${count} videos so far...`),
			);
		} catch (error) {
			console.warn(`  Fetch error on attempt ${attempt}:`, error);
			continue;
		}
		videos = normalized.videos;

		const fetchRatio = normalized.videoCount > 0
			? videos.length / normalized.videoCount
			: (videos.length > 0 ? 1 : 0);
		if (fetchRatio >= 0.9) {
			// Good fetch — exit retry loop
			break;
		}

		console.warn(`  ⚠️  Only fetched ${videos.length}/${normalized.videoCount} videos (${(fetchRatio * 100).toFixed(1)}%) on attempt ${attempt}.`);
		if (attempt === FETCH_RETRIES) {
			console.warn(`  Giving up after ${FETCH_RETRIES} attempts — will fall back to merge.`);
		}
	}

	const playlistData: Playlist = {
		id: normalized.id,
		title: normalized.title,
		description: normalized.description,
		videoCount: normalized.videoCount,
		videos: videos,
		lastFetched: new Date().toISOString(),
	};

	// Safety check and merge: if we still have fewer videos than expected, merge with existing
	const fetchRatio = normalized.videoCount > 0
		? videos.length / normalized.videoCount
		: (videos.length > 0 ? 1 : 0);
	if (videos.length === 0) {
		throw new Error(
			`Pagination failed: fetched 0 videos (expected ~${normalized.videoCount}). Aborting to preserve existing data.`,
		);
	}
	if (fetchRatio < 0.9) {
		console.warn(
			`⚠️  WARNING: Only fetched ${videos.length}/${normalized.videoCount} videos (${(fetchRatio * 100).toFixed(1)}%) after all retries.`,
		);
		console.warn(
			`   Falling back to merge with existing data.`,
		);
		// Merge freshly fetched videos into existing data
		try {
			const existingContent = await fs.readFile(filePath, "utf-8");
			const existingData: Playlist = JSON.parse(existingContent);
			if (existingData.videos.length > 0) {
				const existingIds = new Set(existingData.videos.map((v: Video) => v.id));
				const newVideos = videos.filter((v: Video) => !existingIds.has(v.id));
				console.log(
					`   Existing file has ${existingData.videos.length} videos. Merging ${newVideos.length} new videos.`,
				);
				// Prepend new videos (they are the most recent from the playlist)
				playlistData.videos = [...newVideos, ...existingData.videos];
				playlistData.videoCount = normalized.videoCount;
			}
		} catch {
			// No existing file, proceed with what we have
		}
	}

	// Store the playlist data to file
	try {
		// Ensure the playlists directory exists
		await fs.mkdir(playlistsDir, { recursive: true });

		// Write the playlist data to file
		await fs.writeFile(
			filePath,
			JSON.stringify(playlistData, null, 2),
			"utf-8",
		);
		console.log(`Playlist saved to ${filePath}`);

		// Update the index file
		await updateIndexFile(playlistsDir, playlistData);
		console.log("Index file updated");
	} catch (fileError) {
		console.warn("Failed to cache playlist data:", fileError);
	}

	console.log(`✓ Fetched ${videos.length} videos from playlist`);
	return playlistData;
}

// Step 2: Update playlist with all metadata
async function updatePlaylistMetadata(playlistId: string): Promise<void> {
	console.log(`\n=== Step 2: Updating playlist metadata ===`);

	// Define paths
	const playlistsDir = join(process.cwd(), "public", "playlist");
	const songsDir = join(process.cwd(), "server", "assets", "songs");
	const metadataPath = join(
		process.cwd(),
		"data",
		"anonymized-metadata.json",
	);
	const blacklistPath = join(
		process.cwd(),
		"server",
		"assets",
		"tag-blacklist.json",
	);
	const normalizationPath = join(
		process.cwd(),
		"server",
		"assets",
		"tag-normalization.json",
	);
	const playlistFilePath = join(playlistsDir, `${playlistId}.json`);

	// Load tag blacklist
	let blacklistedTags: string[] = [];
	try {
		const blacklistContent = await fs.readFile(blacklistPath, "utf-8");
		const blacklistData: TagBlacklistData = JSON.parse(blacklistContent);
		blacklistedTags = blacklistData.blacklistedTags || [];
		console.log(`Loaded ${blacklistedTags.length} blacklisted tags`);
	} catch (error) {
		console.warn("Failed to read tag blacklist:", error);
	}

	// Load tag normalization mappings
	let tagNormalizationMap: Record<string, string> = {};
	try {
		const normalizationContent = await fs.readFile(normalizationPath, "utf-8");
		const normalizationData: TagNormalizationData =
			JSON.parse(normalizationContent);
		tagNormalizationMap = normalizationData.mappings || {};
		console.log(
			`Loaded ${Object.keys(tagNormalizationMap).length} tag normalization mappings`,
		);
	} catch (error) {
		console.warn("Failed to read tag normalization mappings:", error);
	}

	// Read the playlist file
	let playlistData: Playlist;
	try {
		const playlistContent = await fs.readFile(playlistFilePath, "utf-8");
		playlistData = JSON.parse(playlistContent);
		console.log(`Loaded playlist with ${playlistData.videos.length} videos`);
	} catch (error) {
		throw new Error(`Playlist ${playlistId} not found`);
	}

	// Read YouTube metadata to create a lookup map
	const youtubeMetadataMap = new Map<string, YouTubeLinkMetadata>();
	try {
		const metadataContent = await fs.readFile(metadataPath, "utf-8");
		const metadataArray: YouTubeLinkMetadata[] = JSON.parse(metadataContent);

		for (const metadata of metadataArray) {
			youtubeMetadataMap.set(metadata.videoId, metadata);
		}
		console.log(`Loaded ${youtubeMetadataMap.size} YouTube metadata entries`);
	} catch (error) {
		console.warn("Failed to read YouTube metadata:", error);
	}

	// Read all song files to create a lookup map
	const songDataMap = new Map<string, SongMetaData>();
	try {
		const songFiles = await fs.readdir(songsDir);

		for (const songFile of songFiles) {
			if (songFile.endsWith(".json")) {
				try {
					const songFilePath = join(songsDir, songFile);
					const songContent = await fs.readFile(songFilePath, "utf-8");
					const songData: SongMetaData = JSON.parse(songContent);

					// Map by YouTube ID (filename without .json extension)
					const youtubeId = songFile.replace(".json", "");
					songDataMap.set(youtubeId, songData);
				} catch (songError) {
					console.warn(`Failed to read song file ${songFile}:`, songError);
				}
			}
		}
		console.log(`Loaded ${songDataMap.size} song metadata entries`);
	} catch (error) {
		console.warn("Failed to read songs directory:", error);
	}

	// Update videos with music data, YouTube metadata, and AI-augmented data
	let updatedCount = 0;
	console.log("Processing videos...");
	const updatedVideos: Video[] = playlistData.videos.map((video) => {
		const songData = songDataMap.get(video.id);
		const youtubeMetadata = youtubeMetadataMap.get(video.id);

		let updatedVideo = { ...video };
		let hasChanges = false;

		// Update with song data if available
		if (songData) {
			// Fuse artistTags, tags, and genres
			const fusedTags: string[] = [];

			// Add Last.fm tags
			if (songData.lastfm?.tags && songData.lastfm.tags.length > 0) {
				fusedTags.push(...songData.lastfm.tags);
			}

			// Add musicbrainz genres
			if (
				songData.musicbrainz?.genres &&
				songData.musicbrainz?.genres.length > 0
			) {
				fusedTags.push(...songData.musicbrainz.genres);
			}

			// Add musicbrainz artistGenres
			if (
				(!songData.musicbrainz?.genres ||
					songData.musicbrainz?.genres.length <= 0) &&
				songData.musicbrainz?.artistGenres &&
				songData.musicbrainz?.artistGenres.length > 0
			) {
				fusedTags.push(...songData.musicbrainz.artistGenres);
			}

			// Normalize tags, remove duplicates, and filter out blacklisted tags
			const normalizedTags = fusedTags.map((tag) => {
				const lowercaseTag = tag.toLowerCase().trim();
				// Check if there's a normalization mapping for this tag
				return tagNormalizationMap[lowercaseTag] || tag;
			});
			const uniqueTags = Array.from(new Set(normalizedTags)).filter(
				(tag) => !blacklistedTags.includes(tag.toLowerCase().trim()),
			);

			// Check for music data changes
			const hasMusicChanges =
				video.artist !== songData.artist ||
				video.musicTitle !== songData.title ||
				JSON.stringify(video.tags || []) !== JSON.stringify(uniqueTags) ||
				JSON.stringify(video.externalIds || {}) !==
					JSON.stringify(songData.odesli || {}) ||
				video.listeners !== songData.lastfm?.listeners ||
				video.playcount !== songData.lastfm?.playcount ||
				video.lastfmSummary !== songData.lastfm?.summary ||
				video.releasedAt !== songData.musicbrainz?.releasedAt ||
				video.artistCountry !== songData.musicbrainz?.artistCountry;

			if (hasMusicChanges) {
				hasChanges = true;
			}

			updatedVideo = {
				...updatedVideo,
				artist: songData.artist,
				musicTitle: songData.title,
				tags: uniqueTags.length > 0 ? uniqueTags : undefined,
				externalIds: songData.odesli,
				listeners: songData.lastfm?.listeners,
				playcount: songData.lastfm?.playcount,
				lastfmSummary: songData.lastfm?.summary,
				releasedAt: songData.musicbrainz?.releasedAt,
				artistCountry: songData.musicbrainz?.artistCountry,
			};
			if (songData.musicbrainz?.trackMbid) {
				if (!updatedVideo.externalIds) {
					updatedVideo.externalIds = {};
				}
				updatedVideo.externalIds["musicbrainz"] =
					songData.musicbrainz.trackMbid;
			}
			if (songData.lastfm?.mbid) {
				if (!updatedVideo.externalIds) {
					updatedVideo.externalIds = {};
				}
				updatedVideo.externalIds["musicbrainz-track"] = songData.lastfm.mbid;
			}
			if (songData.lastfm?.artistMbid) {
				if (!updatedVideo.externalIds) {
					updatedVideo.externalIds = {};
				}
				updatedVideo.externalIds["musicbrainz-artist"] =
					songData.lastfm.artistMbid;
			}
			if (songData.musicbrainz?.artistMbid) {
				if (!updatedVideo.externalIds) {
					updatedVideo.externalIds = {};
				}
				updatedVideo.externalIds["musicbrainz-artist"] =
					songData.musicbrainz?.artistMbid;
			}
			if (songData.lastfm?.id) {
				if (!updatedVideo.externalIds) {
					updatedVideo.externalIds = {};
				}
				updatedVideo.externalIds["lastfm"] = songData.lastfm.id;
			}
		}

		// Update with YouTube metadata if available
		if (youtubeMetadata) {
			// Check for metadata changes
			const hasMetadataChanges =
				video.createdAt !== youtubeMetadata.datetime ||
				video.userId !== youtubeMetadata.userId;

			if (hasMetadataChanges) {
				hasChanges = true;
			}

			updatedVideo = {
				...updatedVideo,
				createdAt: youtubeMetadata.datetime,
				userId: youtubeMetadata.userId,
			};
		}

		if (hasChanges) {
			updatedCount++;
		}
		return updatedVideo;
	});

	// Update the playlist data
	const updatedPlaylistData: Playlist = {
		...playlistData,
		videos: updatedVideos,
		lastFetched: new Date().toISOString(),
	};

	// Write the updated playlist back to file
	try {
		await fs.writeFile(
			playlistFilePath,
			JSON.stringify(updatedPlaylistData, null, 2),
			"utf-8",
		);
		console.log(`✓ Updated ${updatedCount} videos with metadata`);
		console.log(`Playlist saved to ${playlistFilePath}`);
	} catch (writeError) {
		throw new Error("Failed to save updated playlist");
	}
}

// Main execution
async function main() {
	try {
		console.log("=== Fetch and Update Playlist Script ===");
		console.log(`Target Playlist: ${PLAYLIST_ID}\n`);

		// Step 1: Fetch playlist from YouTube
		const playlist = await fetchPlaylist(PLAYLIST_ID);

		// Step 2: Update with all metadata
		await updatePlaylistMetadata(PLAYLIST_ID);

		console.log("\n=== Complete ===");
		console.log(`Successfully fetched and updated playlist ${PLAYLIST_ID}`);
		console.log(`Total videos: ${playlist.videos.length}`);
	} catch (error) {
		console.error("\n=== Error ===");
		console.error("Failed to fetch and update playlist:", error);
		process.exit(1);
	}
}

main();
