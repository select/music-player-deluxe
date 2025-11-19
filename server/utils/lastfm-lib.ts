import type { FetchOptions } from "ofetch";

const IMAGE_WEIGHT = {
	"": 1, // missing size is ranked last
	small: 2,
	medium: 3,
	large: 4,
	extralarge: 5,
	mega: 6,
} as const;

interface LastFMImage {
	"#text": string;
	size: string;
}

interface LastFMConstructorOpts {
	userAgent?: string;
	minArtistListeners?: number;
	minTrackListeners?: number;
}

interface SearchOpts {
	q: string;
	limit?: number;
	artistLimit?: number;
	trackLimit?: number;
	albumLimit?: number;
}

interface PaginationOpts {
	limit?: number;
	page?: number;
}

interface AlbumOpts {
	name: string;
	artistName: string;
}

interface ArtistOpts {
	artist: string;
}

interface TrackOpts {
	track: string;
	artistName: string;
}

interface ArtistSearchOpts extends PaginationOpts {
	artist: string;
}

interface AlbumSearchOpts extends PaginationOpts {
	album: string;
}

interface TrackSearchOpts extends PaginationOpts {
	track: string;
	artist?: string;
}

interface GeoOpts extends PaginationOpts {
	country: string;
}

interface TagOpts extends PaginationOpts {
	tag: string;
}

interface ParsedMeta {
	query: any;
	page: number;
	perPage: number;
	total: number;
	totalPages: number;
}

interface ParsedArtist {
	type: "artist";
	name: string;
	listeners: number;
	images: string[];
}

interface ParsedAlbum {
	type: "album";
	name: string;
	artistName: string;
	listeners?: number;
	images: string[];
}

interface ParsedTrack {
	type: "track";
	name: string;
	artistName: string;
	duration?: number;
	listeners?: number;
	images?: string[];
}

// Parsed response interfaces for methods that return processed data
interface ParsedAlbumInfo {
	type: "album";
	name: string;
	artistName: string;
	images: string[];
	listeners: number;
	tracks: ParsedTrack[];
	tags: string[];
	summary?: string;
}

interface SearchResult {
	meta: ParsedMeta;
	result: {
		type: "search";
		q: string;
		artists: ParsedArtist[];
		tracks: ParsedTrack[];
		albums: ParsedAlbum[];
		top: ParsedArtist | ParsedTrack | ParsedAlbum | null;
	};
}

interface ApiResponse<T> {
	meta: ParsedMeta;
	result: T[];
}

// Last.fm API Response Types
interface LastFMAttr {
	page?: string;
	perPage?: string;
	totalPages?: string;
	total?: string;
	for?: string;
	country?: string;
	tag?: string;
	artist?: string;
	album?: string;
	track?: string;
}

interface LastFMTag {
	name: string;
	url: string;
	count?: number;
	reach?: number;
}

interface LastFMBio {
	links?: {
		link: {
			"#text": string;
			rel: string;
			href: string;
		};
	};
	published?: string;
	summary?: string;
	content?: string;
}

interface LastFMWiki {
	published?: string;
	summary?: string;
	content?: string;
}

interface LastFMStats {
	listeners?: string;
	playcount?: string;
	userplaycount?: string;
}

interface LastFMStreamable {
	"#text": string;
	fulltrack?: string;
}

interface LastFMArtistBase {
	name: string;
	mbid?: string;
	url?: string;
	image?: LastFMImage[];
	streamable?: string;
}

interface LastFMAlbumBase {
	name: string;
	mbid?: string;
	url?: string;
	artist?: string | LastFMArtistBase;
	image?: LastFMImage[];
}

interface LastFMTrackBase {
	name: string;
	mbid?: string;
	url?: string;
	duration?: string;
	streamable?: LastFMStreamable | string;
	listeners?: string;
	playcount?: string;
	artist?: LastFMArtistBase;
	image?: LastFMImage[];
}

// Album API Response Types
interface LastFMAlbumInfo extends LastFMAlbumBase {
	artist: string;
	id?: string;
	listeners?: string;
	playcount?: string;
	userplaycount?: string;
	tracks?: {
		track: LastFMTrackBase[];
	};
	tags?: {
		tag: LastFMTag[];
	};
	wiki?: LastFMWiki;
}

interface LastFMAlbumTopTags {
	"@attr": LastFMAttr;
	tag: LastFMTag[];
}

interface LastFMAlbumSearchResults {
	"@attr": LastFMAttr;
	albummatches: {
		album: LastFMAlbumBase[];
	};
}

// Artist API Response Types
interface LastFMArtistInfo extends LastFMArtistBase {
	listeners?: string;
	playcount?: string;
	userplaycount?: string;
	similar?: {
		artist: LastFMArtistBase[];
	};
	tags?: {
		tag: LastFMTag[];
	};
	bio?: LastFMBio;
	stats?: LastFMStats;
}

interface LastFMArtistCorrection {
	"@attr": LastFMAttr;
	correction: {
		artist: {
			name: string;
			mbid?: string;
			url?: string;
		};
	};
}

interface LastFMArtistSimilar {
	"@attr": LastFMAttr;
	artist: LastFMArtistBase[];
}

interface LastFMArtistTopAlbums {
	"@attr": LastFMAttr;
	album: LastFMAlbumBase[];
}

interface LastFMArtistTopTags {
	"@attr": LastFMAttr;
	tag: LastFMTag[];
}

interface LastFMArtistTopTracks {
	"@attr": LastFMAttr;
	track: LastFMTrackBase[];
}

interface LastFMArtistSearchResults {
	"@attr": LastFMAttr;
	artistmatches: {
		artist: LastFMArtistBase[];
	};
}

// Track API Response Types
interface LastFMTrackInfo extends LastFMTrackBase {
	id?: string;
	userloved?: string;
	userplaycount?: string;
	album?: LastFMAlbumBase;
	toptags?: {
		tag: LastFMTag[];
	};
	wiki?: LastFMWiki;
}

interface LastFMTrackCorrection {
	"@attr": LastFMAttr;
	correction: {
		track: {
			name: string;
			mbid?: string;
			url?: string;
			artist: {
				name: string;
				mbid?: string;
				url?: string;
			};
		};
	};
}

interface LastFMTrackSimilar {
	"@attr": LastFMAttr;
	track: LastFMTrackBase[];
}

interface LastFMTrackTopTags {
	"@attr": LastFMAttr;
	tag: LastFMTag[];
}

interface LastFMTrackSearchResults {
	"@attr": LastFMAttr;
	trackmatches: {
		track: LastFMTrackBase[];
	};
}

// Chart API Response Types
interface LastFMChartTopArtists {
	"@attr": LastFMAttr;
	artist: LastFMArtistBase[];
}

interface LastFMChartTopTags {
	"@attr": LastFMAttr;
	tag: LastFMTag[];
}

interface LastFMChartTopTracks {
	"@attr": LastFMAttr;
	track: LastFMTrackBase[];
}

// Geo API Response Types
interface LastFMGeoTopArtists {
	"@attr": LastFMAttr;
	artist: LastFMArtistBase[];
}

interface LastFMGeoTopTracks {
	"@attr": LastFMAttr;
	track: LastFMTrackBase[];
}

// Tag API Response Types
interface LastFMTagInfo {
	name: string;
	total?: number;
	reach?: number;
	wiki?: LastFMWiki;
}

interface LastFMTagSimilar {
	"@attr": LastFMAttr;
	tag: LastFMTag[];
}

interface LastFMTagTopAlbums {
	"@attr": LastFMAttr;
	album: LastFMAlbumBase[];
}

interface LastFMTagTopArtists {
	"@attr": LastFMAttr;
	artist: LastFMArtistBase[];
}

interface LastFMTagTopTags {
	"@attr": LastFMAttr;
	tag: LastFMTag[];
}

interface LastFMTagTopTracks {
	"@attr": LastFMAttr;
	track: LastFMTrackBase[];
}

// Union type for all possible _sendRequest response types
type LastFMApiResponse =
	// Album responses
	| LastFMAlbumInfo
	| LastFMAlbumTopTags
	| LastFMAlbumSearchResults
	// Artist responses
	| LastFMArtistInfo
	| LastFMArtistCorrection
	| LastFMArtistSimilar
	| LastFMArtistTopAlbums
	| LastFMArtistTopTags
	| LastFMArtistTopTracks
	| LastFMArtistSearchResults
	// Track responses
	| LastFMTrackInfo
	| LastFMTrackCorrection
	| LastFMTrackSimilar
	| LastFMTrackTopTags
	| LastFMTrackSearchResults
	// Chart responses
	| LastFMChartTopArtists
	| LastFMChartTopTags
	| LastFMChartTopTracks
	// Geo responses
	| LastFMGeoTopArtists
	| LastFMGeoTopTracks
	// Tag responses
	| LastFMTagInfo
	| LastFMTagSimilar
	| LastFMTagTopAlbums
	| LastFMTagTopArtists
	| LastFMTagTopTags
	| LastFMTagTopTracks;

class LastFM {
	private _key: string;
	private _userAgent: string;
	private _minArtistListeners: number;
	private _minTrackListeners: number;

	constructor(key: string, opts: LastFMConstructorOpts = {}) {
		if (!key) throw new Error("Missing required `key` argument");
		this._key = key;
		this._userAgent =
			opts.userAgent || "last-fm (https://github.com/feross/last-fm)";
		this._minArtistListeners = opts.minArtistListeners || 0;
		this._minTrackListeners = opts.minTrackListeners || 0;
	}

	private async _sendRequest<T extends LastFMApiResponse = LastFMApiResponse>(
		params: Record<string, any>,
		name: string,
	): Promise<T> {
		const requestParams = {
			...params,
			api_key: this._key,
			format: "json",
		};

		const urlBase = "https://ws.audioscrobbler.com/2.0/";

		const fetchOptions = {
			query: requestParams,
			headers: {
				"User-Agent": this._userAgent,
			},
			timeout: 30 * 1000,
		};

		// const data = await $fetch<any>(urlBase, fetchOptions);
		// if (data.error) {
		// 	throw new Error(data.message);
		// }

		const response = await fetch(
			`${urlBase}?${new URLSearchParams(requestParams)}`,
			{
				headers: {
					"User-Agent": this._userAgent,
				},
			},
		);

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		const data = await response.json();
		if (data.error) {
			throw new Error(data.message);
		}
		return data[name];
	}

	/**
	 * PARSE COMMON RESPONSE PROPERTIES
	 */

	private _parseImages(image: LastFMImage[]): string[] {
		return image
			.sort(
				(a, b) =>
					IMAGE_WEIGHT[a.size as keyof typeof IMAGE_WEIGHT] -
					IMAGE_WEIGHT[b.size as keyof typeof IMAGE_WEIGHT],
			)
			.filter((image) => image.size !== "")
			.map((image) => image["#text"])
			.filter((image) => image && image.length > 0);
	}

	private _parseMeta(data: any, query: any = {}): ParsedMeta {
		if (data["opensearch:totalResults"]) {
			const total = Number(data["opensearch:totalResults"]);
			const perPage = Number(data["opensearch:itemsPerPage"]);
			const page = Number(data["opensearch:startIndex"]) / perPage + 1;
			const totalPages = Math.ceil(total / perPage);
			return { query, page, perPage, total, totalPages };
		} else if (data.page || data.perPage || data.total || data.totalPages) {
			return {
				query,
				page: Number(data.page) || 1,
				perPage: Number(data.perPage) || 50,
				total: Number(data.total) || 0,
				totalPages: Number(data.totalPages) || 1,
			};
		} else {
			return {
				query,
				page: Number(data["@attr"]?.page) || 1,
				perPage: Number(data["@attr"]?.perPage) || 50,
				total: Number(data["@attr"]?.total) || 0,
				totalPages: Number(data["@attr"]?.totalPages) || 1,
			};
		}
	}

	private _parseSummary(summary: string): string {
		return summary.replace(/\s+?<a .*?>Read more on Last\.fm<\/a>.*$/, "");
	}

	/**
	 * PARSE COMMON RESPONSE TYPES
	 */

	private _parseArtists(artists: any[]): ParsedArtist[] {
		return artists
			.map((artist) => {
				return {
					type: "artist" as const,
					name: artist.name,
					listeners: Number(artist.listeners),
					images: this._parseImages(artist.image),
				};
			})
			.filter(
				(artist) =>
					artist.listeners == null ||
					artist.listeners >= this._minArtistListeners,
			);
	}

	private _parseAlbums(albums: any[]): ParsedAlbum[] {
		return albums.map((album) => {
			return {
				type: "album" as const,
				name: album.name,
				artistName: album.artist.name || album.artist,
				listeners:
					(album.playcount && Number(album.playcount)) ||
					(album.listeners && Number(album.listeners)), // optional
				images: this._parseImages(album.image),
			};
		});
	}

	private _parseTags(tags: any): string[] {
		return tags.map((t: any) => t.name);
	}

	private _parseTracks(tracks: any[]): ParsedTrack[] {
		return tracks
			.map((track) => {
				const listeners = track.playcount || track.listeners;
				return {
					type: "track" as const,
					name: track.name,
					artistName: track.artist.name || track.artist,
					duration: track.duration && Number(track.duration), // optional
					listeners: listeners && Number(listeners), // optional
					images: track.image && this._parseImages(track.image), // optional
				};
			})
			.filter(
				(track) =>
					track.listeners == null || track.listeners >= this._minTrackListeners,
			);
	}

	/**
	 * CONVENIENCE API
	 */

	async search(opts: SearchOpts): Promise<SearchResult> {
		const [artists, tracks, albums] = await Promise.all([
			this.artistSearch({
				artist: opts.q,
				limit: opts.artistLimit || opts.limit,
			}),
			this.trackSearch({
				track: opts.q,
				limit: opts.trackLimit || opts.limit,
			}),
			this.albumSearch({ album: opts.q, limit: opts.albumLimit || opts.limit }),
		]);

		const page = artists.meta.page;
		const total = artists.meta.total + tracks.meta.total + albums.meta.total;
		const perPage = artists.meta.perPage * 3;
		const totalPages = Math.ceil(total / perPage);

		const result: SearchResult = {
			meta: { query: opts, page, perPage, total, totalPages },
			result: {
				type: "search",
				q: opts.q,
				artists: artists.result,
				tracks: tracks.result,
				albums: albums.result,
				top: null,
			},
		};

		// Prefer an exact match
		const exactMatch = []
			.concat(result.result.artists, result.result.tracks, result.result.albums)
			.filter((result) => result.name.toLowerCase() === opts.q.toLowerCase())
			.sort((a, b) => (b.listeners || 0) - (a.listeners || 0))[0];

		// Otherwise, use most popular result by listener count. Albums don't have listener count.
		const top = []
			.concat(result.result.artists, result.result.tracks)
			.sort((a, b) => (b.listeners || 0) - (a.listeners || 0))[0];

		result.result.top = exactMatch || top || null;

		return result;
	}

	/**
	 * ALBUM API
	 */

	async albumInfo(opts: AlbumOpts): Promise<ParsedAlbumInfo> {
		const album = await this._sendRequest<LastFMAlbumInfo>(
			{
				method: "album.getInfo",
				album: opts.name,
				artist: opts.artistName,
				autocorrect: 1,
			},
			"album",
		);
		return {
			type: "album",
			name: album.name,
			artistName: album.artist,
			images: this._parseImages(album.image || []),
			listeners: Number(album.playcount) || Number(album.listeners) || 0,
			tracks: this._parseTracks(album.tracks?.track || []),
			tags: this._parseTags(album.tags?.tag || []),
			summary: album.wiki?.content
				? this._parseSummary(album.wiki.content)
				: undefined,
		};
	}

	async albumTopTags(opts: AlbumOpts): Promise<LastFMAlbumTopTags> {
		return await this._sendRequest<LastFMAlbumTopTags>(
			{
				method: "album.getTopTags",
				album: opts.name,
				artist: opts.artistName,
				autocorrect: 1,
			},
			"toptags",
		);
	}

	async albumSearch(opts: AlbumSearchOpts): Promise<ApiResponse<ParsedAlbum>> {
		const data = await this._sendRequest<LastFMAlbumSearchResults>(
			{
				method: "album.search",
				limit: opts.limit,
				page: opts.page,
				album: opts.album,
			},
			"results",
		);
		return {
			meta: this._parseMeta(data["@attr"], opts),
			result: this._parseAlbums(data.albummatches.album),
		};
	}

	/**
	 * ARTIST API
	 */

	async artistCorrection(opts: ArtistOpts): Promise<{ name: string }> {
		const data = await this._sendRequest<LastFMArtistCorrection>(
			{
				method: "artist.getCorrection",
				artist: opts.artist,
			},
			"corrections",
		);
		return {
			name: data.correction.artist.name,
		};
	}

	async artistInfo(opts: ArtistOpts): Promise<LastFMArtistInfo> {
		return await this._sendRequest<LastFMArtistInfo>(
			{
				method: "artist.getInfo",
				artist: opts.artist,
				autocorrect: 1,
			},
			"artist",
		);
	}

	async artistSimilar(
		opts: ArtistOpts & { limit?: number },
	): Promise<LastFMArtistSimilar> {
		return await this._sendRequest<LastFMArtistSimilar>(
			{
				method: "artist.getSimilar",
				artist: opts.artist,
				limit: opts.limit,
				autocorrect: 1,
			},
			"similarartists",
		);
	}

	async artistTopAlbums(
		opts: ArtistOpts & { limit?: number },
	): Promise<ApiResponse<ParsedAlbum>> {
		const data = await this._sendRequest<LastFMArtistTopAlbums>(
			{
				method: "artist.getTopAlbums",
				artist: opts.artist,
				limit: opts.limit,
				autocorrect: 1,
			},
			"topalbums",
		);
		return {
			meta: this._parseMeta(data["@attr"], {}),
			result: this._parseAlbums(data.album),
		};
	}

	async artistTopTags(opts: ArtistOpts): Promise<LastFMArtistTopTags> {
		return await this._sendRequest<LastFMArtistTopTags>(
			{
				method: "artist.getTopTags",
				artist: opts.artist,
				autocorrect: 1,
			},
			"toptags",
		);
	}

	async artistTopTracks(
		opts: ArtistOpts & { limit?: number },
	): Promise<ApiResponse<ParsedTrack>> {
		const data = await this._sendRequest<LastFMArtistTopTracks>(
			{
				method: "artist.getTopTracks",
				artist: opts.artist,
				limit: opts.limit,
				autocorrect: 1,
			},
			"toptracks",
		);
		return {
			meta: this._parseMeta(data["@attr"], {}),
			result: this._parseTracks(data.track),
		};
	}

	async artistSearch(
		opts: ArtistSearchOpts,
	): Promise<ApiResponse<ParsedArtist>> {
		const data = await this._sendRequest<LastFMArtistSearchResults>(
			{
				method: "artist.search",
				limit: opts.limit,
				page: opts.page,
				artist: opts.artist,
			},
			"results",
		);
		return {
			meta: this._parseMeta(data["@attr"], opts),
			result: this._parseArtists(
				data.artistmatches.artist,
				this._minArtistListeners,
			),
		};
	}

	/**
	 * CHART API
	 */

	async chartTopArtists(
		opts: PaginationOpts = {},
	): Promise<ApiResponse<ParsedArtist>> {
		const data = await this._sendRequest<LastFMChartTopArtists>(
			{
				method: "chart.getTopArtists",
				limit: opts.limit,
				page: opts.page,
				autocorrect: 1,
			},
			"artists",
		);
		return {
			meta: this._parseMeta(data["@attr"], {}),
			result: this._parseArtists(data.artist, this._minArtistListeners),
		};
	}

	async chartTopTags(opts: PaginationOpts = {}): Promise<LastFMChartTopTags> {
		return await this._sendRequest<LastFMChartTopTags>(
			{
				method: "chart.getTopTags",
				limit: opts.limit,
				page: opts.page,
				autocorrect: 1,
			},
			"tags",
		);
	}

	async chartTopTracks(
		opts: PaginationOpts = {},
	): Promise<ApiResponse<ParsedTrack>> {
		const data = await this._sendRequest<LastFMChartTopTracks>(
			{
				method: "chart.getTopTracks",
				limit: opts.limit,
				page: opts.page,
				autocorrect: 1,
			},
			"tracks",
		);
		return {
			meta: this._parseMeta(data["@attr"], opts),
			result: this._parseTracks(data.track),
		};
	}

	/**
	 * GEO API
	 */

	async geoTopArtists(opts: GeoOpts): Promise<LastFMGeoTopArtists> {
		return await this._sendRequest<LastFMGeoTopArtists>(
			{
				method: "geo.getTopArtists",
				country: opts.country,
				limit: opts.limit,
				page: opts.page,
				autocorrect: 1,
			},
			"topartists",
		);
	}

	async geoTopTracks(opts: GeoOpts): Promise<LastFMGeoTopTracks> {
		return await this._sendRequest<LastFMGeoTopTracks>(
			{
				method: "geo.getTopTracks",
				country: opts.country,
				limit: opts.limit,
				page: opts.page,
				autocorrect: 1,
			},
			"toptracks",
		);
	}

	/**
	 * TAG API
	 */

	async tagInfo(opts: { tag: string }): Promise<LastFMTagInfo> {
		return await this._sendRequest<LastFMTagInfo>(
			{
				method: "tag.getInfo",
				tag: opts.tag,
			},
			"tag",
		);
	}

	async tagSimilar(opts: { tag: string }): Promise<LastFMTagSimilar> {
		return await this._sendRequest<LastFMTagSimilar>(
			{
				method: "tag.getSimilar",
				tag: opts.tag,
			},
			"similartags",
		);
	}

	async tagTopAlbums(opts: TagOpts): Promise<LastFMTagTopAlbums> {
		return await this._sendRequest<LastFMTagTopAlbums>(
			{
				method: "tag.getTopAlbums",
				limit: opts.limit,
				page: opts.page,
				tag: opts.tag,
			},
			"albums",
		);
	}

	async tagTopArtists(opts: TagOpts): Promise<LastFMTagTopArtists> {
		return await this._sendRequest<LastFMTagTopArtists>(
			{
				method: "tag.getTopArtists",
				limit: opts.limit,
				page: opts.page,
				tag: opts.tag,
			},
			"artists",
		);
	}

	async tagTopTags(): Promise<LastFMTagTopTags> {
		return await this._sendRequest<LastFMTagTopTags>(
			{
				method: "tag.getTopTags",
			},
			"toptags",
		);
	}

	async tagTopTracks(opts: TagOpts): Promise<LastFMTagTopTracks> {
		return await this._sendRequest<LastFMTagTopTracks>(
			{
				method: "tag.getTopTracks",
				limit: opts.limit,
				page: opts.page,
				tag: opts.tag,
			},
			"tracks",
		);
	}

	/**
	 * TRACK API
	 */

	async trackCorrection(
		opts: TrackOpts,
	): Promise<{ name: string; artistName: string }> {
		const data = await this._sendRequest<LastFMTrackCorrection>(
			{
				method: "track.getCorrection",
				artist: opts.artistName,
				track: opts.track,
			},
			"corrections",
		);
		return {
			name: data.correction.track.name,
			artistName: data.correction.track.artist.name,
		};
	}

	async trackInfo(opts: TrackOpts): Promise<LastFMTrackInfo> {
		return await this._sendRequest<LastFMTrackInfo>(
			{
				method: "track.getInfo",
				artist: opts.artistName,
				track: opts.track,
				autocorrect: 1,
			},
			"track",
		);
	}

	async trackSimilar(opts: TrackOpts): Promise<LastFMTrackSimilar> {
		return await this._sendRequest<LastFMTrackSimilar>(
			{
				method: "track.getSimilar",
				artist: opts.artistName,
				track: opts.track,
				autocorrect: 1,
			},
			"similartracks",
		);
	}

	async trackTopTags(opts: TrackOpts): Promise<LastFMTrackTopTags> {
		return await this._sendRequest<LastFMTrackTopTags>(
			{
				method: "track.getTopTags",
				artist: opts.artistName,
				track: opts.track,
				autocorrect: 1,
			},
			"toptags",
		);
	}

	async trackSearch(opts: TrackSearchOpts): Promise<ApiResponse<ParsedTrack>> {
		const data = await this._sendRequest<LastFMTrackSearchResults>(
			{
				method: "track.search",
				limit: opts.limit,
				page: opts.page,
				track: opts.track,
				artist: opts.artist,
			},
			"results",
		);
		return {
			meta: this._parseMeta(data["@attr"], opts),
			result: this._parseTracks(data.trackmatches.track),
		};
	}
}

export default LastFM;

// Export all return types of LastFM class methods
export type {
	// Convenience API
	SearchResult,

	// Album API
	ParsedAlbumInfo,
	LastFMAlbumTopTags,
	ApiResponse,

	// Artist API
	ParsedArtistInfo,
	LastFMArtistSimilar,
	LastFMArtistTopTags,

	// Chart API
	LastFMChartTopTags,

	// Geo API
	LastFMGeoTopArtists,
	LastFMGeoTopTracks,

	// Tag API
	LastFMTagInfo,
	LastFMTagSimilar,
	LastFMTagTopAlbums,
	LastFMTagTopArtists,
	LastFMTagTopTags,
	LastFMTagTopTracks,

	// Track API
	ParsedTrackInfo,
	LastFMTrackSimilar,
	LastFMTrackTopTags,
	LastFMTrackInfo,

	// Parsed types used in ApiResponse
	ParsedArtist,
	ParsedAlbum,
	ParsedTrack,
	ParsedMeta,
};
