// @unocss-include
export interface Platform {
	id: string;
	name: string;
	icon: string;
	getUrl: (id: string) => string;
}

// Platform definitions
export const PLATFORMS: Record<string, Platform> = {
	musicbrainz: {
		id: "musicbrainz",
		name: "MusicBrainz",
		icon: "i-simple-icons:musicbrainz",
		getUrl: (id: string) => `https://musicbrainz.org/recording/${id}`,
	},
	lastfm: {
		id: "lastfm",
		name: "Last.fm",
		icon: "i-simple-icons:lastdotfm",
		getUrl: (id: string) => `https://www.last.fm/music/${id}`,
	},
	bandcamp: {
		id: "bandcamp",
		name: "Bandcamp",
		icon: "i-mdi-bandcamp",
		getUrl: (id: string) => `https://bandcamp.com/track/${id}`,
	},
	spotify: {
		id: "spotify",
		name: "Spotify",
		icon: "i-mdi-spotify",
		getUrl: (id: string) => `https://open.spotify.com/track/${id}`,
	},
	appleMusic: {
		id: "appleMusic",
		name: "Apple Music",
		icon: "i-mdi-apple",
		getUrl: (id: string) => `https://music.apple.com/song/${id}`,
	},
	amazonMusic: {
		id: "amazonMusic",
		name: "Amazon Music",
		icon: "i-mdi-amazon",
		getUrl: (id: string) => `https://music.amazon.com/tracks/${id}`,
	},
	youtube: {
		id: "youtube",
		name: "YouTube",
		icon: "i-mdi-youtube",
		getUrl: (id: string) => `https://www.youtube.com/watch?v=${id}`,
	},
	youtubeMusic: {
		id: "youtubeMusic",
		name: "YouTube Music",
		icon: "i-material-symbols:youtube-music",
		getUrl: (id: string) => `https://music.youtube.com/watch?v=${id}`,
	},

	pandora: {
		id: "pandora",
		name: "Pandora",
		icon: "i-mdi-pandora",
		getUrl: (id: string) => `https://www.pandora.com/artist/track/${id}`,
	},
	deezer: {
		id: "deezer",
		name: "Deezer",
		icon: "i-mdi-music-circle",
		getUrl: (id: string) => `https://www.deezer.com/track/${id}`,
	},
	tidal: {
		id: "tidal",
		name: "Tidal",
		icon: "i-mdi-waves",
		getUrl: (id: string) => `https://tidal.com/browse/track/${id}`,
	},
	soundcloud: {
		id: "soundcloud",
		name: "SoundCloud",
		icon: "i-mdi-soundcloud",
		getUrl: (id: string) => `https://soundcloud.com/${id}`,
	},

	audiomack: {
		id: "audiomack",
		name: "Audiomack",
		icon: "i-mdi-music-note",
		getUrl: (id: string) => `https://audiomack.com/song/${id}`,
	},
	napster: {
		id: "napster",
		name: "Napster",
		icon: "i-mdi-music",
		getUrl: (id: string) => `https://napster.com/track/${id}`,
	},
	yandex: {
		id: "yandex",
		name: "Yandex Music",
		icon: "i-tabler:brand-yandex",
		getUrl: (id: string) => `https://music.yandex.com/track/${id}`,
	},
	itunes: {
		id: "itunes",
		name: "iTunes",
		icon: "i-mdi-itunes",
		getUrl: (id: string) => `https://music.apple.com/song/${id}`,
	},
	googlePlay: {
		id: "googlePlay",
		name: "Google Play Music",
		icon: "i-mdi-google-play",
		getUrl: (id: string) => `https://play.google.com/music/m/${id}`,
	},
};

// Default platforms to show (preselected)
export const DEFAULT_SELECTED_PLATFORMS = [
	"spotify",
	"musicbrainz",
	"lastfm",
	"bandcamp",
];

// Utility functions
export const getPlatformIcon = (platformId: string): string => {
	return PLATFORMS[platformId]?.icon || "i-mdi-music-circle-outline";
};

export const getPlatformName = (platformId: string): string => {
	return PLATFORMS[platformId]?.name || platformId;
};

export const getPlatformUrl = (platformId: string, id: string): string => {
	const platform = PLATFORMS[platformId];
	return platform ? platform.getUrl(id) : `#${platformId}-${id}`;
};

// Get all available platforms as array
export const getAllPlatforms = (): Platform[] => {
	return Object.values(PLATFORMS);
};

// Filter platforms by selected IDs
export const getSelectedPlatforms = (selectedIds: string[]): Platform[] => {
	return selectedIds
		.map((id) => PLATFORMS[id])
		.filter((platform): platform is Platform => Boolean(platform));
};

// Get available platforms from externalIds
export const getAvailablePlatforms = (
	externalIds?: Record<string, string>,
): Platform[] => {
	if (!externalIds) return [];

	return Object.keys(externalIds)
		.map((platformId) => PLATFORMS[platformId])
		.filter((platform): platform is Platform => Boolean(platform));
};
