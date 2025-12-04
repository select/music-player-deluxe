import { readdir, readFile, writeFile } from "fs/promises";
import { fileURLToPath } from "url";
import * as path from "path";
import type { SongMetaData } from "../app/types/playlist.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SOURCES_FILE = path.join(__dirname, "../public/stats/sources.json");
const SONGS_DIR = path.join(__dirname, "../server/assets/songs");
const PLAYLIST_FILE = path.join(
	__dirname,
	"../public/playlist/PLHh-DPsAXiAUVUVA9DpRtiYRrwgvqg8Fx.json",
);
const NORMALIZATION_FILE = path.join(
	__dirname,
	"../server/assets/tag-normalization.json",
);
const ANONYMIZED_METADATA_FILE = path.join(
	__dirname,
	"../data/anonymized-metadata.json",
);

interface SourceData {
	url: string;
	name: string;
	summary: string;
	items?: number;
	tags?: number;
}

interface PlaylistData {
	items: number;
	itemsWithTags: number;
	itemsWithExternalIds: number;
	externalIdsByPlatform: Record<string, number>;
	topTags: Array<{ tag: string; count: number }>;
	topTagsByUser: Record<
		string,
		{
			tags: Array<{ tag: string; count: number }>;
			totalSongs: number;
		}
	>;
	itemsWithCountry: number;
	topCountries: Array<{ country: string; count: number }>;
	itemsWithReleaseDate: number;
	releaseYears: Array<{ year: string; count: number }>;
	postsPerYear: Array<{ year: string; count: number }>;
}

interface SourcesData {
	sources: Record<string, SourceData>;
	playlist: PlaylistData;
}

interface TagNormalizationData {
	mappings: Record<string, string>;
}

// Load tag normalization mappings
async function loadTagNormalization(): Promise<Record<string, string>> {
	try {
		const content = await readFile(NORMALIZATION_FILE, "utf-8");
		const data: TagNormalizationData = JSON.parse(content);
		return data.mappings || {};
	} catch (error) {
		console.warn("Failed to load tag normalization mappings:", error);
		return {};
	}
}

// Normalize a tag using the normalization mappings
function normalizeTag(tag: string, mappings: Record<string, string>): string {
	const lowercaseTag = tag.toLowerCase().trim();
	return mappings[lowercaseTag] || tag;
}

// Scan anonymized metadata for posts per year
async function scanAnonymizedMetadata(): Promise<Map<string, number>> {
	const postsPerYear = new Map<string, number>();

	try {
		const content = await readFile(ANONYMIZED_METADATA_FILE, "utf-8");
		const metadata = JSON.parse(content);

		if (Array.isArray(metadata)) {
			for (const entry of metadata) {
				if (entry.datetime) {
					const date = new Date(entry.datetime);
					const year = date.getFullYear().toString();
					postsPerYear.set(year, (postsPerYear.get(year) || 0) + 1);
				}
			}
		}
	} catch (error) {
		console.warn("Failed to load anonymized metadata:", error);
	}

	return postsPerYear;
}

async function scanSongFiles(): Promise<{
	musicbrainzCount: number;
	lastfmCount: number;
	odesliCount: number;
	ollamaCount: number;
	musicbrainzTags: Set<string>;
	lastfmTags: Set<string>;
}> {
	const files = await readdir(SONGS_DIR);
	const jsonFiles = files.filter((f) => f.endsWith(".json"));

	let musicbrainzCount = 0;
	let lastfmCount = 0;
	let odesliCount = 0;
	let ollamaCount = 0;
	const musicbrainzTags = new Set<string>();
	const lastfmTags = new Set<string>();

	for (const file of jsonFiles) {
		const filePath = path.join(SONGS_DIR, file);
		const content = await readFile(filePath, "utf-8");
		const song: SongMetaData = JSON.parse(content);

		if (song.musicbrainz) {
			musicbrainzCount++;
			if (song.musicbrainz.genres) {
				song.musicbrainz.genres.forEach((g) => musicbrainzTags.add(g));
			}
			if (song.musicbrainz.artistGenres) {
				song.musicbrainz.artistGenres.forEach((g) => musicbrainzTags.add(g));
			}
		}

		if (song.lastfm) {
			lastfmCount++;
			if (song.lastfm.tags) {
				song.lastfm.tags.forEach((t) => lastfmTags.add(t));
			}
		}

		if (song.odesli) {
			odesliCount++;
		}

		if (song.ai) {
			ollamaCount++;
		}
	}

	return {
		musicbrainzCount,
		lastfmCount,
		odesliCount,
		ollamaCount,
		musicbrainzTags,
		lastfmTags,
	};
}

async function scanPlaylistData(
	tagNormalizationMap: Record<string, string>,
): Promise<{
	totalItems: number;
	itemsWithTags: number;
	itemsWithExternalIds: number;
	externalIdCounts: Record<string, number>;
	tagCounts: Map<string, number>;
	tagCountsByUser: Map<string, Map<string, number>>;
	songCountsByUser: Map<string, number>;
	itemsWithCountry: number;
	countryCounts: Map<string, number>;
	itemsWithReleaseDate: number;
	releaseYearCounts: Map<string, number>;
}> {
	const content = await readFile(PLAYLIST_FILE, "utf-8");
	const playlist = JSON.parse(content);

	const externalIdCounts: Record<string, number> = {};
	const tagCounts = new Map<string, number>();
	const tagCountsByUser = new Map<string, Map<string, number>>();
	const songCountsByUser = new Map<string, number>();
	const countryCounts = new Map<string, number>();
	const releaseYearCounts = new Map<string, number>();
	let totalItems = 0;
	let itemsWithTags = 0;
	let itemsWithExternalIds = 0;
	let itemsWithCountry = 0;
	let itemsWithReleaseDate = 0;

	if (playlist.videos && Array.isArray(playlist.videos)) {
		totalItems = playlist.videos.length;

		for (const video of playlist.videos) {
			const userId = video.userId || "Anonymous";

			// Count songs per user
			songCountsByUser.set(userId, (songCountsByUser.get(userId) || 0) + 1);

			// Count videos with tags
			if (video.tags && Array.isArray(video.tags) && video.tags.length > 0) {
				itemsWithTags++;

				// Count overall tags (with normalization)
				for (const tag of video.tags) {
					const normalizedTag = normalizeTag(tag, tagNormalizationMap);
					tagCounts.set(normalizedTag, (tagCounts.get(normalizedTag) || 0) + 1);
				}

				// Count tags per user (with normalization)
				if (!tagCountsByUser.has(userId)) {
					tagCountsByUser.set(userId, new Map());
				}
				const userTags = tagCountsByUser.get(userId)!;
				for (const tag of video.tags) {
					const normalizedTag = normalizeTag(tag, tagNormalizationMap);
					userTags.set(normalizedTag, (userTags.get(normalizedTag) || 0) + 1);
				}
			}

			// Count videos with any external IDs
			if (video.externalIds && typeof video.externalIds === "object") {
				const hasAnyExternalId = Object.values(video.externalIds).some(
					(id) => id,
				);
				if (hasAnyExternalId) {
					itemsWithExternalIds++;
				}

				// Count external IDs per platform
				for (const [platform, id] of Object.entries(video.externalIds)) {
					if (id) {
						externalIdCounts[platform] = (externalIdCounts[platform] || 0) + 1;
					}
				}
			}

			// Count videos with country
			if (video.artistCountry) {
				itemsWithCountry++;
				countryCounts.set(
					video.artistCountry,
					(countryCounts.get(video.artistCountry) || 0) + 1,
				);
			}

			// Count videos with release date and extract year
			if (video.releasedAt) {
				itemsWithReleaseDate++;
				const year = video.releasedAt.split("-")[0];
				if (year) {
					releaseYearCounts.set(year, (releaseYearCounts.get(year) || 0) + 1);
				}
			}
		}
	}

	return {
		totalItems,
		itemsWithTags,
		itemsWithExternalIds,
		externalIdCounts,
		tagCounts,
		tagCountsByUser,
		songCountsByUser,
		itemsWithCountry,
		countryCounts,
		itemsWithReleaseDate,
		releaseYearCounts,
	};
}

async function updateSources(): Promise<void> {
	console.log("Reading sources file...");
	const sourcesContent = await readFile(SOURCES_FILE, "utf-8");
	const sourcesData: SourcesData = JSON.parse(sourcesContent);

	console.log("Loading tag normalization mappings...");
	const tagNormalizationMap = await loadTagNormalization();

	console.log("Scanning song files...");
	const {
		musicbrainzCount,
		lastfmCount,
		odesliCount,
		ollamaCount,
		musicbrainzTags,
		lastfmTags,
	} = await scanSongFiles();

	console.log("Scanning playlist data...");
	const {
		totalItems,
		itemsWithTags,
		itemsWithExternalIds,
		externalIdCounts,
		tagCounts,
		tagCountsByUser,
		songCountsByUser,
		itemsWithCountry,
		countryCounts,
		itemsWithReleaseDate,
		releaseYearCounts,
	} = await scanPlaylistData(tagNormalizationMap);

	console.log("Scanning anonymized metadata for posts per year...");
	const postsPerYearMap = await scanAnonymizedMetadata();

	// Update source items and tags
	if (sourcesData.sources.musicbrainz) {
		sourcesData.sources.musicbrainz.items = musicbrainzCount;
		sourcesData.sources.musicbrainz.tags = musicbrainzTags.size;
	}
	if (sourcesData.sources.lastfm) {
		sourcesData.sources.lastfm.items = lastfmCount;
		sourcesData.sources.lastfm.tags = lastfmTags.size;
	}
	if (sourcesData.sources.odesli) {
		sourcesData.sources.odesli.items = odesliCount;
	}
	if (sourcesData.sources.ollama) {
		sourcesData.sources.ollama.items = ollamaCount;
	}

	// Process top tags
	const topTags = Array.from(tagCounts.entries())
		.map(([tag, count]) => ({ tag, count }))
		.sort((a, b) => b.count - a.count)
		.slice(0, 50);

	// Process top tags by user (only users with 10+ songs)
	const topTagsByUser: Record<
		string,
		{ tags: Array<{ tag: string; count: number }>; totalSongs: number }
	> = {};
	for (const [userId, userTagMap] of tagCountsByUser.entries()) {
		const userSongCount = songCountsByUser.get(userId) || 0;
		if (userSongCount >= 10) {
			topTagsByUser[userId] = {
				tags: Array.from(userTagMap.entries())
					.map(([tag, count]) => ({ tag, count }))
					.sort((a, b) => b.count - a.count)
					.slice(0, 10),
				totalSongs: userSongCount,
			};
		}
	}

	// Process top countries
	const topCountries = Array.from(countryCounts.entries())
		.map(([country, count]) => ({ country, count }))
		.sort((a, b) => b.count - a.count);

	// Process release years
	const releaseYears = Array.from(releaseYearCounts.entries())
		.map(([year, count]) => ({ year, count }))
		.sort((a, b) => a.year.localeCompare(b.year)); // Sort chronologically

	// Process posts per year
	const postsPerYear = Array.from(postsPerYearMap.entries())
		.map(([year, count]) => ({ year, count }))
		.sort((a, b) => a.year.localeCompare(b.year)); // Sort chronologically

	// Update playlist data
	sourcesData.playlist = {
		items: totalItems,
		itemsWithTags: itemsWithTags,
		itemsWithExternalIds: itemsWithExternalIds,
		externalIdsByPlatform: externalIdCounts,
		topTags: topTags,
		topTagsByUser: topTagsByUser,
		itemsWithCountry: itemsWithCountry,
		topCountries: topCountries,
		itemsWithReleaseDate: itemsWithReleaseDate,
		releaseYears: releaseYears,
		postsPerYear: postsPerYear,
	};

	console.log("Writing updated sources file...");
	await writeFile(SOURCES_FILE, JSON.stringify(sourcesData, null, 2));

	console.log("\nSummary:");
	console.log(
		`- MusicBrainz: ${musicbrainzCount} items, ${musicbrainzTags.size} unique tags`,
	);
	console.log(
		`- Last.fm: ${lastfmCount} items, ${lastfmTags.size} unique tags`,
	);
	console.log(`- Odesli: ${odesliCount} items`);
	console.log(`- Ollama: ${ollamaCount} items`);
	console.log(
		`- Playlist: ${totalItems} total items, ${itemsWithTags} items with tags, ${itemsWithExternalIds} items with external IDs`,
	);
	console.log(
		`- External IDs by platform: ${Object.keys(externalIdCounts).length} platforms`,
	);
}

updateSources().catch(console.error);
