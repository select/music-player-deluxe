import { promises as fs } from "fs";
import { join } from "path";
import type {
	Playlist,
	Video,
	SongMetaData,
	YouTubeLinkMetadata,
} from "~/types";

interface AIAugmentedData {
	title: string;
	channel: string;
	ai?: {
		artist: string;
		track: string;
		tags?: string[];
		tagsConfidence?: number;
	};
}

interface UpdateDataRequest {
	playlistId: string;
}

interface UpdateDataResponse {
	success: boolean;
	message: string;
	updatedVideos: number;
	totalVideos: number;
}

export default defineEventHandler(async (event) => {
	try {
		const body = (await readBody(event)) as UpdateDataRequest;

		if (!body.playlistId) {
			throw createError({
				statusCode: 400,
				statusMessage: "Playlist ID is required",
			});
		}

		const { playlistId } = body;

		// Define paths
		const playlistsDir = join(process.cwd(), "public", "playlist");
		const songsDir = join(process.cwd(), "server", "assets", "songs");
		const metadataPath = join(
			process.cwd(),
			"data",
			"anonymized-metadata.json",
		);
		const aiAugmentedPath = join(process.cwd(), "data", "ai-augmented.json");
		const playlistFilePath = join(playlistsDir, `${playlistId}.json`);

		// Read the playlist file
		let playlistData: Playlist;
		try {
			const playlistContent = await fs.readFile(playlistFilePath, "utf-8");
			playlistData = JSON.parse(playlistContent);
		} catch (error) {
			throw createError({
				statusCode: 404,
				statusMessage: `Playlist ${playlistId} not found`,
			});
		}

		// Read YouTube metadata to create a lookup map
		const youtubeMetadataMap = new Map<string, YouTubeLinkMetadata>();
		try {
			const metadataContent = await fs.readFile(metadataPath, "utf-8");
			const metadataArray: YouTubeLinkMetadata[] = JSON.parse(metadataContent);

			for (const metadata of metadataArray) {
				youtubeMetadataMap.set(metadata.videoId, metadata);
			}
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
		} catch (error) {
			console.warn("Failed to read songs directory:", error);
		}

		// Read AI-augmented data to create a lookup map
		const aiAugmentedMap = new Map<string, AIAugmentedData>();
		try {
			const aiAugmentedContent = await fs.readFile(aiAugmentedPath, "utf-8");
			const aiAugmentedArray: AIAugmentedData[] =
				JSON.parse(aiAugmentedContent);

			for (const aiData of aiAugmentedArray) {
				// Create lookup key using title and channel for matching
				const lookupKey = `${aiData.title.toLowerCase()}|${aiData.channel.toLowerCase()}`;
				aiAugmentedMap.set(lookupKey, aiData);
			}
		} catch (error) {
			console.warn("Failed to read AI-augmented data:", error);
		}

		// Update videos with music data, YouTube metadata, and AI-augmented data
		let updatedCount = 0;
		const updatedVideos: Video[] = playlistData.videos.map((video) => {
			const songData = songDataMap.get(video.id);
			const youtubeMetadata = youtubeMetadataMap.get(video.id);

			// Try to find AI-augmented data by matching title and channel
			const aiLookupKey = `${video.title.toLowerCase()}|${video.channel?.toLowerCase() || ""}`;
			const aiData = aiAugmentedMap.get(aiLookupKey);

			let updatedVideo = { ...video };
			let hasChanges = false;

			// Update with song data if available
			if (songData) {
				// Fuse artistTags, tags, and genres
				const fusedTags: string[] = [];

				// Add recording tags
				if (songData.tags && songData.tags.length > 0) {
					fusedTags.push(...songData.tags);
				}

				// Add genres
				if (songData.genres && songData.genres.length > 0) {
					fusedTags.push(...songData.genres);
				}

				// Add artist tags
				if (songData.artistTags && songData.artistTags.length > 0) {
					fusedTags.push(...songData.artistTags);
				}

				// Remove duplicates and sort
				const uniqueTags = Array.from(new Set(fusedTags)).sort();

				// Check for music data changes
				const hasMusicChanges =
					video.artist !== songData.artist ||
					video.musicTitle !== songData.title ||
					JSON.stringify(video.tags || []) !== JSON.stringify(uniqueTags) ||
					JSON.stringify(video.externalIds || {}) !==
						JSON.stringify(songData.odesli || {});

				if (hasMusicChanges) {
					hasChanges = true;
				}

				updatedVideo = {
					...updatedVideo,
					artist: songData.artist,
					musicTitle: songData.title,
					tags: uniqueTags.length > 0 ? uniqueTags : undefined,
					externalIds: songData.odesli,
				};
				if (songData.mbid) {
					if (!updatedVideo.externalIds) {
						updatedVideo.externalIds = {};
					}
					updatedVideo.externalIds["musicbrainz"] = songData.mbid;
				}
			}

			// Update with AI-augmented data if available and no MusicBrainz data exists
			if (aiData?.ai && !songData) {
				// Fuse AI tags with existing tags
				const fusedTags: string[] = [];

				// Add existing tags
				if (video.tags && video.tags.length > 0) {
					fusedTags.push(...video.tags);
				}

				// Add AI tags
				if (aiData.ai.tags && aiData.ai.tags.length > 0) {
					fusedTags.push(...aiData.ai.tags);
				}

				// Remove duplicates and sort
				const uniqueTags = Array.from(new Set(fusedTags)).sort();

				// Only update artist and musicTitle if they don't already exist
				const newArtist = video.artist || aiData.ai.artist;
				const newMusicTitle = video.musicTitle || aiData.ai.track;

				// Check for AI data changes
				const hasAiChanges =
					video.artist !== newArtist ||
					video.musicTitle !== newMusicTitle ||
					JSON.stringify(video.tags || []) !== JSON.stringify(uniqueTags);

				if (hasAiChanges) {
					hasChanges = true;
				}

				updatedVideo = {
					...updatedVideo,
					artist: newArtist,
					musicTitle: newMusicTitle,
					tags: uniqueTags.length > 0 ? uniqueTags : undefined,
				};
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
			console.log("updatedVideo", updatedVideo);
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
		} catch (writeError) {
			throw createError({
				statusCode: 500,
				statusMessage: "Failed to save updated playlist",
			});
		}

		return {
			success: true,
			message: `Successfully updated ${updatedCount} videos with music data, AI-augmented data, and metadata`,
			updatedVideos: updatedCount,
			totalVideos: playlistData.videos.length,
		} as UpdateDataResponse;
	} catch (error: any) {
		console.error("Error updating playlist music data:", error);

		throw createError({
			statusCode: error.statusCode || 500,
			statusMessage:
				error.statusMessage ||
				"Failed to update playlist music data, AI-augmented data, and metadata",
		});
	}
});
