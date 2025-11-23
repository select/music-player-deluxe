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
		const playlistFilePath = join(playlistsDir, `${playlistId}.json`);

		// Read the playlist file
		let playlistData: Playlist;
		try {
			const playlistContent = await fs.readFile(playlistFilePath, "utf-8");
			playlistData = JSON.parse(playlistContent);
		} catch {
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

		// Update videos with music data, YouTube metadata, and AI-augmented data
		let updatedCount = 0;
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
					songData.musicbrainz?.artistGenres &&
					songData.musicbrainz?.artistGenres.length > 0
				) {
					fusedTags.push(...songData.musicbrainz.artistGenres);
				}

				// Add musicbrainz tags
				if (
					songData.musicbrainz?.tags &&
					songData.musicbrainz.tags.length > 0
				) {
					fusedTags.push(...songData.musicbrainz.tags);
				}

				// Add artist tags
				if (
					songData.musicbrainz?.artistTags &&
					songData.musicbrainz.artistTags.length > 0
				) {
					fusedTags.push(...songData.musicbrainz.artistTags);
				}

				// Remove duplicates while preserving order
				const uniqueTags = Array.from(new Set(fusedTags));

				// Check for music data changes
				const hasMusicChanges =
					video.artist !== songData.artist ||
					video.musicTitle !== songData.title ||
					JSON.stringify(video.tags || []) !== JSON.stringify(uniqueTags) ||
					JSON.stringify(video.externalIds || {}) !==
						JSON.stringify(songData.odesli || {}) ||
					video.listeners !== songData.lastfm?.listeners ||
					video.playcount !== songData.lastfm?.playcount ||
					video.lastfmSummary !== songData.lastfm?.summary;

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
				};
				if (songData.mbid) {
					if (!updatedVideo.externalIds) {
						updatedVideo.externalIds = {};
					}
					updatedVideo.externalIds["musicbrainz"] = songData.mbid;
				}
				if (songData.trackMbid) {
					if (!updatedVideo.externalIds) {
						updatedVideo.externalIds = {};
					}
					updatedVideo.externalIds["musicbrainz-track"] = songData.trackMbid;
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
				if (songData.artistMbid) {
					if (!updatedVideo.externalIds) {
						updatedVideo.externalIds = {};
					}
					updatedVideo.externalIds["musicbrainz-artist"] = songData.artistMbid;
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
