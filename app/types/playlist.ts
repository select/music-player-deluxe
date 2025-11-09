export interface Video {
	id: string;
	title: string;
	channel: string;
	duration: string;
	thumbnail: string;
	url: string;
	// Music data fields (populated from MusicBrainz)
	artist?: string;
	musicTitle?: string;
	tags?: string[];
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

export interface MusicBrainzSongData {
	mbid: string;
	title: string;
	artist: string;
	artistMbid?: string;
	album?: string;
	releaseCount: number;
	tags: string[];
	artistTags?: string[];
	duration?: number;
	youtubeId: string;
	lastFetched: string;
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
	data?: MusicBrainzSongData;
	cached?: boolean;
}

export interface MusicBrainzMatchRequest {
	videoId: string;
	selectedMbid: string;
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
