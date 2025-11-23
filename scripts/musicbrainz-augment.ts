import { MusicBrainzApi } from "musicbrainz-api";
import { promises as fs } from "fs";
import { join } from "path";
import type { SongMetaData } from "../app/types";

const mbApi = new MusicBrainzApi({
	appName: "MusicPlaylistView",
	appVersion: "1.0.0",
	appContactInfo: "contact@example.com",
});

// Rate limiting utility
const delay = (ms: number): Promise<void> =>
	new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Fetches MusicBrainz metadata (tags, genres) for recording and artist
 * @param mbid - The MusicBrainz recording ID
 * @param artistMbid - The MusicBrainz artist ID (optional)
 * @returns MusicBrainz metadata object with tags and genres
 */
async function fetchMusicBrainzMetadata(
	mbid: string,
	artistMbid?: string,
): Promise<{
	tags?: string[];
	genres?: string[];
	artistTags?: string[];
	artistGenres?: string[];
} | null> {
	try {
		const metadata: {
			tags?: string[];
			genres?: string[];
			artistTags?: string[];
			artistGenres?: string[];
		} = {};

		// Fetch recording data with tags and genres
		let recordingData: any = null;
		try {
			recordingData = await mbApi.lookup("recording", mbid, ["tags", "genres"]);
		} catch (error) {
			console.log(`Recording lookup failed for ${mbid}, trying as track ID...`);

			// If recording lookup fails, try using the ID as a track ID
			try {
				const trackData = await mbApi.lookup("track", mbid, ["recording"]);
				if (trackData && trackData.recording && trackData.recording.id) {
					const actualRecordingId = trackData.recording.id;
					console.log(
						`Found recording ID ${actualRecordingId} from track ${mbid}`,
					);

					// Update the file to store the old ID as trackMbid and the recording ID as mbid
					recordingData = await mbApi.lookup("recording", actualRecordingId, [
						"tags",
						"genres",
					]);

					// Return special object indicating we need to update the file
					const result = await fetchMusicBrainzMetadata(
						actualRecordingId,
						artistMbid,
					);
					if (result) {
						return {
							...result,
							_needsIdUpdate: true,
							_oldId: mbid,
							_newRecordingId: actualRecordingId,
						} as any;
					}
				}
			} catch (trackError) {
				console.error(`Both recording and track lookup failed for ${mbid}`);
				return null;
			}
		}

		if (recordingData) {
			// Extract tags
			if (recordingData.tags && recordingData.tags.length > 0) {
				metadata.tags = recordingData.tags
					.filter((tag: any) => tag.count >= 1)
					.map((tag: any) => tag.name)
					.slice(0, 10); // Limit to top 10 tags
			}

			// Extract genres
			if (recordingData.genres && recordingData.genres.length > 0) {
				metadata.genres = recordingData.genres
					.filter((genre: any) => genre.count >= 1)
					.map((genre: any) => genre.name)
					.slice(0, 5); // Limit to top 5 genres
			}
		}

		// Fetch artist data if artistMbid is provided
		if (artistMbid) {
			try {
				const artistData = await mbApi.lookup("artist", artistMbid, [
					"genres",
					"tags",
				]);

				// Extract artist tags
				if (artistData && artistData.tags && artistData.tags.length > 0) {
					metadata.artistTags = artistData.tags
						.filter((tag: any) => tag.count >= 1)
						.map((tag: any) => tag.name)
						.slice(0, 10); // Limit to top 10 artist tags
				}

				// Extract artist genres
				if (artistData && artistData.genres && artistData.genres.length > 0) {
					metadata.artistGenres = artistData.genres
						.filter((genre: any) => genre.count >= 1)
						.map((genre: any) => genre.name)
						.slice(0, 5); // Limit to top 5 artist genres
				}
			} catch (artistError) {
				console.warn(`Failed to fetch artist data for ${artistMbid}`);
			}
		}

		return Object.keys(metadata).length > 0 ? metadata : null;
	} catch (error) {
		console.error(`Failed to fetch MusicBrainz metadata for ${mbid}:`, error);
		return null;
	}
}

/**
 * Fetches artist MBID for a recording using MusicBrainz API
 * @param recordingMbid - The MusicBrainz recording ID
 * @returns Artist MBID or null if not found
 */
async function fetchArtistMbidFromRecording(
	recordingMbid: string,
): Promise<string | null> {
	try {
		const recordingData = (await mbApi.lookup("recording", recordingMbid, [
			"artist-credits",
		])) as any;

		if (
			recordingData &&
			recordingData["artist-credit"] &&
			recordingData["artist-credit"].length > 0
		) {
			return recordingData["artist-credit"][0].artist.id || null;
		}

		return null;
	} catch (error) {
		console.error(
			`Failed to fetch artist MBID for recording ${recordingMbid}:`,
			error,
		);
		return null;
	}
}

/**
 * Finds songs that have mbid and/or artistMbid but are missing MusicBrainz metadata
 */
async function findSongsForMusicBrainzAugmentation(): Promise<string[]> {
	try {
		const songsDir = join(process.cwd(), "server", "assets", "songs");

		// Check if songs directory exists
		try {
			await fs.access(songsDir);
		} catch {
			console.error("Songs directory not found:", songsDir);
			return [];
		}

		const songFiles = await fs.readdir(songsDir);
		const jsonFiles = songFiles.filter((songFile) =>
			songFile.endsWith(".json"),
		);

		console.log(`Found ${jsonFiles.length} JSON files to process...`);

		const fileResults = await Promise.allSettled(
			jsonFiles.map(async (songFile) => {
				const filePath = join(songsDir, songFile);
				try {
					const fileContent = await fs.readFile(filePath, "utf-8");
					const songData: SongMetaData = JSON.parse(fileContent);
					return { songData, filePath, fileName: songFile };
				} catch (error) {
					console.warn(`Failed to parse ${songFile}:`, error);
					return null;
				}
			}),
		);

		const songsNeedingMBData = fileResults
			.filter(
				(
					result,
				): result is PromiseFulfilledResult<{
					songData: SongMetaData;
					filePath: string;
					fileName: string;
				} | null> => result.status === "fulfilled" && result.value !== null,
			)
			.map((result) => result.value!)
			.filter(({ songData }) => {
				// Has mbid but missing musicbrainz metadata OR missing artistMbid
				return songData.mbid && (!songData.musicbrainz || !songData.artistMbid);
			})
			.map(
				({ songData, fileName }) =>
					songData.youtubeId || fileName.replace(".json", ""),
			);

		return songsNeedingMBData;
	} catch (error) {
		console.error("Error scanning songs directory:", error);
		return [];
	}
}

/**
 * Augments songs with MusicBrainz metadata (tags, genres) with rate limiting
 */
async function augmentSongsWithMusicBrainzData(
	youtubeIds: string[],
): Promise<void> {
	const songsDir = join(process.cwd(), "server", "assets", "songs");

	console.log(
		`\nAugmenting ${youtubeIds.length} songs with MusicBrainz metadata (1 request per second)...\n`,
	);

	for (const [index, youtubeId] of youtubeIds.entries()) {
		try {
			const filePath = join(songsDir, `${youtubeId}.json`);
			const fileContent = await fs.readFile(filePath, "utf-8");
			let songData: SongMetaData = JSON.parse(fileContent);

			if (!songData.mbid) {
				console.log(
					`${index + 1}/${youtubeIds.length} ${youtubeId}: No mbid found, skipping`,
				);
				continue;
			}

			console.log(
				`${index + 1}/${youtubeIds.length} ${youtubeId}: Processing MusicBrainz data...`,
			);

			let needsFileUpdate = false;

			// First, check if we need to fetch artist MBID
			if (!songData.artistMbid) {
				console.log(`   Fetching missing artist MBID...`);
				const artistMbid = await fetchArtistMbidFromRecording(songData.mbid);

				if (artistMbid) {
					songData.artistMbid = artistMbid;
					needsFileUpdate = true;
					console.log(`   ✅ Found artistMbid: ${artistMbid}`);

					// Add a small delay between artist lookup and metadata fetch
					await delay(1000);
				} else {
					console.log(`   ❌ Could not fetch artist MBID`);
				}
			}

			// Then fetch full metadata if missing
			if (!songData.musicbrainz) {
				console.log(`   Fetching MusicBrainz metadata...`);
				const mbMetadata = await fetchMusicBrainzMetadata(
					songData.mbid,
					songData.artistMbid,
				);

				if (mbMetadata) {
					needsFileUpdate = true;

					// Check if we need to update IDs (when track ID was converted to recording ID)
					if ((mbMetadata as any)._needsIdUpdate) {
						const { _oldId, _newRecordingId, ...cleanMetadata } =
							mbMetadata as any;
						songData = {
							...songData,
							trackMbid: _oldId,
							mbid: _newRecordingId,
							musicbrainz: cleanMetadata,
						};
						console.log(
							`   🔄 Updated IDs: track=${_oldId}, recording=${_newRecordingId}`,
						);
					} else {
						songData.musicbrainz = mbMetadata;
					}

					const metadataInfo = [];
					if (mbMetadata.tags?.length)
						metadataInfo.push(`${mbMetadata.tags.length} tags`);
					if (mbMetadata.genres?.length)
						metadataInfo.push(`${mbMetadata.genres.length} genres`);
					if (mbMetadata.artistTags?.length)
						metadataInfo.push(`${mbMetadata.artistTags.length} artist tags`);
					if (mbMetadata.artistGenres?.length)
						metadataInfo.push(
							`${mbMetadata.artistGenres.length} artist genres`,
						);

					console.log(`   ✅ Metadata: ${metadataInfo.join(", ")}`);
				} else {
					console.log(`   ❌ Could not fetch MusicBrainz metadata`);
				}
			} else {
				console.log(`   ℹ️  Already has MusicBrainz metadata`);
			}

			// Update file if any changes were made
			if (needsFileUpdate) {
				songData.lastFetched = new Date().toISOString();
				await fs.writeFile(
					filePath,
					JSON.stringify(songData, null, 2),
					"utf-8",
				);
				console.log(`   💾 File updated`);
			}

			// Rate limit: wait 1 second between requests (except for the last one)
			if (index < youtubeIds.length - 1) {
				await delay(1000);
			}
		} catch (error) {
			console.error(
				`${index + 1}/${youtubeIds.length} ${youtubeId}: Error processing -`,
				error,
			);
		}
	}
}

/**
 * Main execution function
 */
async function main(): Promise<void> {
	const args = process.argv.slice(2);
	const shouldFetch = args.includes("--fetch");

	// Unified MusicBrainz augmentation workflow
	const songsForAugmentation = await findSongsForMusicBrainzAugmentation();

	if (songsForAugmentation.length === 0) {
		console.log("No songs found that need MusicBrainz data processing");
		return;
	}

	console.log(
		`Found ${songsForAugmentation.length} songs needing MusicBrainz data (missing metadata or artistMbid):`,
	);
	songsForAugmentation.forEach((id) => console.log(id));

	if (shouldFetch) {
		await augmentSongsWithMusicBrainzData(songsForAugmentation);
		console.log(
			"\n🎉 Finished processing MusicBrainz data (artist MBIDs + metadata)!",
		);
	} else {
		console.log(
			"\nTo fetch and update MusicBrainz data, run with --fetch flag",
		);
	}

	console.log("\nUsage:");
	console.log(
		"  --fetch: Complete MusicBrainz processing (artist MBIDs + metadata)",
	);
}

// Run the script
main().catch((error) => {
	console.error("Script failed:", error);
	process.exit(1);
});
