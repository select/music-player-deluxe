import Odesli from "odesli.js";

interface TitleArtistCandidate {
	title: string;
	artist: string;
	count: number;
	sources: string[];
}

export interface OdesliSongData {
	entityUniqueId: string;
	title: string;
	artist: string[];
	type: string;
	thumbnail?: string;
	userCountry: string;
	pageUrl: string;
	linksByPlatform: Record<
		string,
		{
			entityUniqueId: string;
			url: string;
			nativeAppUriMobile?: string;
			nativeAppUriDesktop?: string;
		}
	>;
	entitiesByUniqueId: Record<
		string,
		{
			id: string;
			type: string;
			title: string;
			artistName: string[];
			thumbnailUrl?: string;
			apiProvider: string;
			platforms: string[];
		}
	>;
}

// Type the odesli API response based on the documentation
interface OdesliApiResponse {
	entityUniqueId: string;
	title: string;
	artist: string[];
	type: string;
	thumbnail?: string;
	userCountry?: string;
	pageUrl?: string;
	linksByPlatform?: Record<
		string,
		{
			entityUniqueId: string;
			url: string;
			nativeAppUriMobile?: string;
			nativeAppUriDesktop?: string;
		}
	>;
	entitiesByUniqueId?: Record<
		string,
		{
			id: string;
			type: string;
			title: string;
			artistName: string[];
			thumbnailUrl?: string;
			apiProvider: string;
			platforms: string[];
		}
	>;
}

interface OdesliErrorResult {
	error: string;
	youtubeId: string;
}

type OdesliResult = OdesliSongData | OdesliErrorResult;

// Initialize Odesli client
const odesli = new Odesli({
	// You can add API key here for higher rate limits
	// apiKey: 'your-api-key-here',
	cache: true,
	timeout: 10000,
	maxRetries: 3,
	retryDelay: 1000,
});

/**
 * Fetches song data from Odesli API using a YouTube ID
 * @param youtubeId - The YouTube video ID
 * @returns Promise that resolves to song data object or error object
 */
export async function getOdesliSongData(
	youtubeId: string,
): Promise<OdesliResult> {
	try {
		if (!youtubeId) {
			return {
				error: "YouTube ID is required",
				youtubeId,
			};
		}

		// Construct YouTube URL from ID
		const youtubeUrl = `https://www.youtube.com/watch?v=${youtubeId}`;

		// Fetch song data from Odesli API
		const songData = (await odesli.fetch(youtubeUrl, {
			country: "US", // Default to US, can be made configurable
		})) as OdesliApiResponse;

		// Return the full song data object
		return {
			entityUniqueId: songData.entityUniqueId,
			title: songData.title,
			artist: songData.artist || [],
			type: songData.type,
			thumbnail: songData.thumbnail,
			userCountry: songData.userCountry || "US",
			pageUrl: songData.pageUrl || "",
			linksByPlatform: songData.linksByPlatform || {},
			entitiesByUniqueId: songData.entitiesByUniqueId || {},
		};
	} catch (error: any) {
		console.error(
			"Error fetching Odesli data for YouTube ID:",
			youtubeId,
			error,
		);

		// Return error object instead of throwing
		return {
			error: error.message || "Failed to fetch song data from Odesli",
			youtubeId,
		};
	}
}

/**
 * Checks if the result is an error
 * @param result - The result from getOdesliSongData
 * @returns Type guard for error results
 */
export function isOdesliError(
	result: OdesliResult,
): result is OdesliErrorResult {
	return "error" in result;
}

/**
 * Fetches song data for multiple YouTube IDs with concurrency control
 * @param youtubeIds - Array of YouTube video IDs
 * @param concurrency - Maximum number of concurrent requests (default: 3)
 * @returns Promise that resolves to array of song data or error objects
 */
export async function getBatchOdesliSongData(
	youtubeIds: string[],
	concurrency: number = 3,
): Promise<OdesliResult[]> {
	if (!youtubeIds.length) {
		return [];
	}

	// Convert YouTube IDs to URLs
	const youtubeUrls = youtubeIds.map(
		(id) => `https://www.youtube.com/watch?v=${id}`,
	);

	try {
		// Use odesli's built-in batch fetching with concurrency control
		const results = (await odesli.fetch(youtubeUrls, {
			country: "US",
			concurrency,
		})) as OdesliApiResponse[];

		// Map results back to our format, handling errors
		return results.map((result: any, index: number): OdesliResult => {
			if (result.error) {
				return {
					error: result.error,
					youtubeId: youtubeIds[index],
				} as OdesliErrorResult;
			}

			return {
				entityUniqueId: result.entityUniqueId,
				title: result.title,
				artist: result.artist || [],
				type: result.type,
				thumbnail: result.thumbnail,
				userCountry: result.userCountry || "US",
				pageUrl: result.pageUrl || "",
				linksByPlatform: result.linksByPlatform || {},
				entitiesByUniqueId: result.entitiesByUniqueId || {},
			} as OdesliSongData;
		});
	} catch (error: any) {
		console.error("Error in batch Odesli fetch:", error);

		// Return error objects for all IDs
		return youtubeIds.map((youtubeId) => ({
			error: error.message || "Failed to fetch song data from Odesli",
			youtubeId,
		}));
	}
}

/**
 * Extracts streaming platform links from Odesli data
 * @param songData - The song data from Odesli
 * @returns Object with platform names as keys and URLs as values
 */
export function extractPlatformLinks(
	songData: OdesliSongData,
): Record<string, string> {
	return Object.entries(songData.linksByPlatform)
		.filter(([_, data]) => data.url)
		.reduce(
			(links, [platform, data]) => ({
				...links,
				[platform]: data.url,
			}),
			{} as Record<string, string>,
		);
}

/**
 * Gets available platforms for a song
 * @param songData - The song data from Odesli
 * @returns Array of platform names
 */
export function getAvailablePlatforms(songData: OdesliSongData): string[] {
	return Object.keys(songData.linksByPlatform);
}

/**
 * Extracts platform IDs from Odesli data
 * @param odesliData - The Odesli song data
 * @returns Object with platform names as keys and IDs as values
 */
export function extractPlatformIds(
	odesliData: OdesliSongData,
): Record<string, string> {
	return Object.entries(odesliData.linksByPlatform)
		.filter(([_, data]) => data.entityUniqueId)
		.map(([platform, data]) => {
			const id = data.entityUniqueId.split("::")[1];
			return { platform, id };
		})
		.filter((item): item is { platform: string; id: string } =>
			Boolean(item.id),
		)
		.reduce(
			(platformIds, { platform, id }) => ({
				...platformIds,
				[platform]: id,
			}),
			{} as Record<string, string>,
		);
}

/**
 * Finds the most common title and artist from Odesli entities
 * @param odesliData - The Odesli song data
 * @returns Object with the most common title and artist
 */
export function extractMostCommonTitleAndArtist(odesliData: OdesliSongData): {
	title: string;
	artist: string;
} {
	if (
		!odesliData.entitiesByUniqueId ||
		Object.keys(odesliData.entitiesByUniqueId).length === 0
	) {
		// Fallback to the main title and artist from Odesli
		return {
			title: odesliData.title || "Unknown Title",
			artist: Array.isArray(odesliData.artist)
				? odesliData.artist[0] || "Unknown Artist"
				: odesliData.artist || "Unknown Artist",
		};
	}

	// Analyze all entities
	const { titleCounts, artistCounts } = Object.entries(
		odesliData.entitiesByUniqueId,
	).reduce(
		(acc, [entityId, entity]) => {
			const exactTitle = entity.title;
			const exactArtist = entity.artistName[0] || "Unknown Artist";
			const titleKey = exactTitle.toLowerCase();
			const artistKey = exactArtist.toLowerCase();

			// Count exact titles
			const updatedTitleCounts = {
				...acc.titleCounts,
				[titleKey]: acc.titleCounts[titleKey]
					? {
							...acc.titleCounts[titleKey],
							count: acc.titleCounts[titleKey].count + 1,
							sources: [
								...acc.titleCounts[titleKey].sources,
								entity.apiProvider,
							],
						}
					: {
							title: exactTitle,
							artist: exactArtist,
							count: 1,
							sources: [entity.apiProvider],
						},
			};

			// Count exact artists
			const updatedArtistCounts = {
				...acc.artistCounts,
				[artistKey]: acc.artistCounts[artistKey]
					? {
							...acc.artistCounts[artistKey],
							count: acc.artistCounts[artistKey].count + 1,
							sources: [
								...acc.artistCounts[artistKey].sources,
								entity.apiProvider,
							],
						}
					: {
							title: exactTitle,
							artist: exactArtist,
							count: 1,
							sources: [entity.apiProvider],
						},
			};

			return {
				titleCounts: updatedTitleCounts,
				artistCounts: updatedArtistCounts,
			};
		},
		{
			titleCounts: {} as Record<string, TitleArtistCandidate>,
			artistCounts: {} as Record<string, TitleArtistCandidate>,
		},
	);

	// Find most common title
	const mostCommonTitleCandidate = Object.values(titleCounts).reduce(
		(max, candidate) => (candidate.count > max.count ? candidate : max),
		{
			title: "Unknown Title",
			artist: "Unknown Artist",
			count: 0,
			sources: [],
		} as TitleArtistCandidate,
	);
	const mostCommonTitle = mostCommonTitleCandidate.title;
	const maxTitleCount = mostCommonTitleCandidate.count;

	// Find most common artist
	const mostCommonArtistCandidate = Object.values(artistCounts).reduce(
		(max, candidate) => (candidate.count > max.count ? candidate : max),
		{
			title: "Unknown Title",
			artist: "Unknown Artist",
			count: 0,
			sources: [],
		} as TitleArtistCandidate,
	);
	const mostCommonArtist = mostCommonArtistCandidate.artist;
	const maxArtistCount = mostCommonArtistCandidate.count;

	// If no clear winner, prioritize certain providers
	const priorityProviders = [
		"spotify",
		"appleMusic",
		"itunes",
		"deezer",
		"tidal",
	];

	const finalMostCommonTitle =
		maxTitleCount === 1 && Object.keys(titleCounts).length > 1
			? priorityProviders
					.map((provider) =>
						Object.values(titleCounts).find((candidate) =>
							candidate.sources.includes(provider),
						),
					)
					.find((candidate) => candidate !== undefined)?.title ||
				mostCommonTitle
			: mostCommonTitle;

	const finalMostCommonArtist =
		maxArtistCount === 1 && Object.keys(artistCounts).length > 1
			? priorityProviders
					.map((provider) =>
						Object.values(artistCounts).find((candidate) =>
							candidate.sources.includes(provider),
						),
					)
					.find((candidate) => candidate !== undefined)?.artist ||
				mostCommonArtist
			: mostCommonArtist;

	return {
		title: finalMostCommonTitle,
		artist: finalMostCommonArtist,
	};
}
