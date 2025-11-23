export interface Video {
	id: string;
	title: string;
	channel: string;
	duration: string;

	// Music data fields (populated from MusicBrainz)
	artist?: string;
	musicTitle?: string;
	tags?: string[];
	// YouTube metadata fields
	createdAt?: number;
	userId?: string | null;
	// External platform IDs
	externalIds?: Record<string, string>;
	// Last.fm fields
	listeners?: number;
	playcount?: number;
	lastfmSummary?: string;
}

export interface Playlist {
	id: string;
	title: string;
	description: string;
	videoCount: number;
	videos: Video[];
	lastFetched: string;
}

export interface PlaylistSummary {
	id: string;
	title: string;
	description: string;
	videoCount: number;
	lastFetched: string;
	fileName: string;
}

export interface IndexResponse {
	success: boolean;
	data: PlaylistSummary[];
	count: number;
	lastUpdated: string;
}

export interface ApiResponse<T> {
	success: boolean;
	data: T;
	cached?: boolean;
}

export interface MusicBrainzSearchResult {
	id: string;
	title: string;
	artist: string;
	releaseCount: number;
	score: number;
	disambiguation?: string;
}

export interface SongMetaData {
	mbid?: string;
	trackMbid?: string;
	title: string;
	artist?: string;
	artistMbid?: string;
	album?: string;
	releaseCount?: number;
	duration?: number;
	youtubeId: string;
	lastFetched: string;
	datetime?: number;
	userId?: string | null;
	odesli?: Record<string, string>;
	musicbrainz?: {
		tags?: string[];
		genres?: string[];
		artistTags?: string[];
		artistGenres?: string[];
	};
	lastfm?: {
		summary?: string;
		tags?: string[];
		playcount?: number;
		listeners?: number;
		id?: string;
		mbid?: string;
		artistMbid?: string;
	};
}

export interface SearchRequest {
	video: Video;
}

export interface SearchResponse {
	success: boolean;
	results: MusicBrainzSearchResult[];
	query: string;
}

export interface MusicBrainzResponse {
	success: boolean;
	data?: SongMetaData;
	cached?: boolean;
}

export interface MusicBrainzMatchRequest {
	videoId: string;
	mbid: string;
}

export interface MusicBrainzSearchRequest {
	videoId: string;
	artist: string;
	title: string;
}

export interface ParsedTitle {
	artist: string;
	title: string;
	confidence: number; // 0-1, how confident we are in the parsing
}

export interface UpdateDataResponse {
	success: boolean;
	message: string;
	updatedVideos: number;
	totalVideos: number;
}

export interface YouTubeLinkMetadata {
	videoId: string;
	datetime: number;
	userId: string | null;
}
