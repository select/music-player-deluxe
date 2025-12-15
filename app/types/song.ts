export interface SongMetaData {
	title: string;
	artist?: string;
	album?: string;
	duration?: number;
	youtubeId: string;
	lastFetched: string;
	datetime?: number;
	userId?: string | null;
	odesli?: Record<string, string>;
	ai?: {
		title?: string;
		artist?: string;
	};
	musicbrainz?: {
		trackMbid?: string;
		artistMbid?: string;
		releaseCount?: number;
		tags?: string[];
		genres?: string[];
		artistTags?: string[];
		artistGenres?: string[];
		releasedAt?: string;
		artistCountry?: string;
		externalIdsTrack?: Record<string, string>;
		externalIdsArtist?: Record<string, string>;
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
	curated?: {
		artist: string;
		title: string;
	};
	youtube?: {
		title: string;
		channel: string;
	};
}
