import { useStorage } from "@vueuse/core";
import type { KeyboardShortcutScheme } from "~/types";
import { DEFAULT_SELECTED_PLATFORMS } from "~/utils/platforms";

export type ViewMode = "grid" | "list" | "timeline";

export interface VideoPlayerPosition {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface KeyboardShortcuts {
	playPause: string;
	nextTrack: string;
	previousTrack: string;
	volumeUp: string;
	volumeDown: string;
	mute: string;
	seekForward: string;
	seekBackward: string;
	focusSearch: string;
}

export interface UserSettings {
	keyboardShortcutScheme: KeyboardShortcutScheme;
	customShortcuts?: KeyboardShortcuts;
	selectedPlatforms?: string[];
}

// Predefined keyboard shortcut schemes
export const KEYBOARD_SHORTCUTS: Record<
	KeyboardShortcutScheme,
	KeyboardShortcuts
> = {
	simple: {
		playPause: " ",
		nextTrack: "ArrowRight",
		previousTrack: "ArrowLeft",
		volumeUp: "ArrowUp",
		volumeDown: "ArrowDown",
		mute: "m",
		seekForward: "l",
		seekBackward: "j",
		focusSearch: "ctrl+k",
	},
	winamp: {
		playPause: "c",
		nextTrack: "b",
		previousTrack: "z",
		volumeUp: "ArrowUp",
		volumeDown: "ArrowDown",
		mute: "m",
		seekForward: "v",
		seekBackward: "c",
		focusSearch: "ctrl+k",
	},
	youtube: {
		playPause: "k",
		nextTrack: "n",
		previousTrack: "p",
		volumeUp: "ArrowUp",
		volumeDown: "ArrowDown",
		mute: "m",
		seekForward: "l",
		seekBackward: "j",
		focusSearch: "ctrl+k",
	},
};

export const useUserSettingsStore = defineStore("userSettingsStore", () => {
	// State
	const settings = ref<UserSettings>({
		keyboardShortcutScheme: "winamp",
		selectedPlatforms: DEFAULT_SELECTED_PLATFORMS,
	});

	// Track if shortcuts are enabled
	const shortcutsEnabled = ref<boolean>(true);

	// View mode with persistent storage
	const viewMode = useStorage<ViewMode>("video-view-mode", "list");

	// Video player position and size with persistent storage
	const videoPlayerPosition = useStorage<VideoPlayerPosition>(
		"video-player-position",
		{
			x: 100,
			y: 100,
			width: 320,
			height: 240,
		},
	);

	// Computed
	const currentKeyboardShortcuts = computed<KeyboardShortcuts>(() => {
		if (settings.value.customShortcuts) {
			return settings.value.customShortcuts;
		}
		return KEYBOARD_SHORTCUTS[settings.value.keyboardShortcutScheme];
	});

	const availableShortcutSchemes = computed(() => [
		{ value: "simple", label: "Simple (Space, Arrow Keys)" },
		{ value: "winamp", label: "Winamp Style (X, Z, B, C, V)" },
		{ value: "youtube", label: "YouTube Style (K, J, L, N, P)" },
	]);

	// Actions
	const setKeyboardShortcutScheme = (scheme: KeyboardShortcutScheme): void => {
		settings.value.keyboardShortcutScheme = scheme;
		// Clear custom shortcuts when switching to predefined scheme
		settings.value.customShortcuts = undefined;
		saveSettings();
	};

	const setSelectedPlatforms = (platforms: string[]): void => {
		settings.value.selectedPlatforms = platforms;
		saveSettings();
	};

	const resetToDefaults = (): void => {
		settings.value = {
			keyboardShortcutScheme: "simple",
			selectedPlatforms: DEFAULT_SELECTED_PLATFORMS,
		};
		saveSettings();
	};

	// Enable/disable shortcuts
	const enableShortcuts = (): void => {
		shortcutsEnabled.value = true;
	};

	const disableShortcuts = (): void => {
		shortcutsEnabled.value = false;
	};

	// Persistence
	const saveSettings = (): void => {
		if (process.client) {
			localStorage.setItem("userSettings", JSON.stringify(settings.value));
		}
	};

	const loadSettings = (): void => {
		if (process.client) {
			try {
				const stored = localStorage.getItem("userSettings");
				if (stored) {
					const parsedSettings = JSON.parse(stored) as UserSettings;
					settings.value = {
						keyboardShortcutScheme:
							parsedSettings.keyboardShortcutScheme || "simple",
						customShortcuts: parsedSettings.customShortcuts,
						selectedPlatforms:
							parsedSettings.selectedPlatforms || DEFAULT_SELECTED_PLATFORMS,
					};
				}
			} catch (error) {
				console.warn("Failed to load user settings:", error);
				resetToDefaults();
			}
		}
	};

	// Keyboard event handler
	const handleKeyDown = (event: KeyboardEvent): void => {
		if (!shortcutsEnabled.value) return;

		const globalPlayerStore = usePlayerStore();
		const handled = handleKeyboardEvent(event, globalPlayerStore);

		// Additional global shortcuts that aren't media-related
		if (!handled) {
			// Handle Ctrl+K for search focus
			if (event.ctrlKey && event.key.toLowerCase() === "k") {
				event.preventDefault();
				const searchInput = document.getElementById("search");
				if (searchInput) {
					searchInput.focus();
				}
			}
		}
	};

	// Keyboard event handler
	const handleKeyboardEvent = (
		event: KeyboardEvent,
		globalPlayerStore: ReturnType<typeof usePlayerStore>,
	): boolean => {
		// Ignore if user is typing in an input field or interacting with form elements
		const target = event.target as HTMLElement;

		if (
			target instanceof HTMLInputElement ||
			target instanceof HTMLTextAreaElement ||
			target instanceof HTMLSelectElement ||
			target?.contentEditable === "true" ||
			// Check if target is inside a form element or has input-related classes
			target?.closest("input, textarea, select, [contenteditable]") ||
			// Check for common input wrapper classes
			target?.closest(
				"[class*='input'], [class*='select'], [class*='dropdown']",
			) ||
			// Check if any parent has role="textbox" or similar
			target?.closest(
				"[role='textbox'], [role='combobox'], [role='searchbox']",
			) ||
			// Check for Vue component input wrappers
			target?.closest("[data-input], [data-multiselect]")
		) {
			return false;
		}

		const shortcuts = currentKeyboardShortcuts.value;
		const key = event.key.toLowerCase();

		// Prevent default for our handled shortcuts
		let handled = false;

		// Handle play/pause (support Space key for YouTube scheme as well)
		if (
			key === shortcuts.playPause ||
			(settings.value.keyboardShortcutScheme === "youtube" && key === " ")
		) {
			event.preventDefault();
			globalPlayerStore.togglePlayPause();
			handled = true;
		} else if (key === shortcuts.nextTrack) {
			event.preventDefault();
			globalPlayerStore.nextVideo();
			handled = true;
		} else if (key === shortcuts.previousTrack) {
			event.preventDefault();
			globalPlayerStore.previousVideo();
			handled = true;
		} else if (key === shortcuts.mute) {
			event.preventDefault();
			// TODO: Implement mute functionality
			handled = true;
		} else if (key === shortcuts.volumeUp) {
			event.preventDefault();
			// TODO: Implement volume up functionality
			handled = true;
		} else if (key === shortcuts.volumeDown) {
			event.preventDefault();
			// TODO: Implement volume down functionality
			handled = true;
		} else if (key === shortcuts.seekForward) {
			event.preventDefault();
			// TODO: Implement seek forward functionality
			handled = true;
		} else if (key === shortcuts.seekBackward) {
			event.preventDefault();
			// TODO: Implement seek backward functionality
			handled = true;
		}

		return handled;
	};

	// Setup global keyboard listeners
	const setupGlobalListeners = (): void => {
		if (process.client) {
			document.addEventListener("keydown", handleKeyDown);
		}
	};

	// Cleanup global keyboard listeners
	const cleanupGlobalListeners = (): void => {
		if (process.client) {
			document.removeEventListener("keydown", handleKeyDown);
		}
	};

	// Setup Media Session API for hardware media keys
	const setupMediaSession = (): void => {
		if (!process.client || !("mediaSession" in navigator)) return;

		const globalPlayerStore = usePlayerStore();

		try {
			// Set up action handlers for media keys
			navigator.mediaSession.setActionHandler("play", () => {
				if (
					globalPlayerStore.youtubePlayerInstance &&
					globalPlayerStore.isPlayerReady
				) {
					globalPlayerStore.youtubePlayerInstance.playVideo();
				}
			});

			navigator.mediaSession.setActionHandler("pause", () => {
				if (
					globalPlayerStore.youtubePlayerInstance &&
					globalPlayerStore.isPlayerReady
				) {
					globalPlayerStore.youtubePlayerInstance.pauseVideo();
				}
			});

			navigator.mediaSession.setActionHandler("previoustrack", () => {
				const store = usePlayerStore();
				store.previousVideo();
			});

			navigator.mediaSession.setActionHandler("nexttrack", () => {
				const store = usePlayerStore();
				store.nextVideo();
			});

			// Optional: handle seek events if supported
			navigator.mediaSession.setActionHandler("seekbackward", () => {
				if (
					globalPlayerStore.youtubePlayerInstance &&
					globalPlayerStore.isPlayerReady
				) {
					const currentTime =
						globalPlayerStore.youtubePlayerInstance.getCurrentTime();
					globalPlayerStore.youtubePlayerInstance.seekTo(
						Math.max(0, currentTime - 10),
					);
				}
			});

			navigator.mediaSession.setActionHandler("seekforward", () => {
				if (
					globalPlayerStore.youtubePlayerInstance &&
					globalPlayerStore.isPlayerReady
				) {
					const currentTime =
						globalPlayerStore.youtubePlayerInstance.getCurrentTime();
					globalPlayerStore.youtubePlayerInstance.seekTo(currentTime + 10);
				}
			});
		} catch (error) {
			// Silently fail if media session setup fails
		}
	};

	// Update Media Session metadata when video changes
	const updateMediaSessionMetadata = (video: Video | null): void => {
		if (!process.client || !("mediaSession" in navigator) || !video) return;

		const globalPlayerStore = usePlayerStore();
		const playlistStore = usePlaylistStore();

		navigator.mediaSession.metadata = new MediaMetadata({
			title: video.title || "Unknown Title",
			artist: video.artist || "Unknown Artist",
			album: video.album || undefined,
			artwork: video.thumbnail
				? [
						{
							src: video.thumbnail,
							sizes: "512x512",
							type: "image/jpeg",
						},
					]
				: undefined,
		});

		// Set position state with duration from YouTube player
		try {
			if (
				globalPlayerStore.youtubePlayerInstance &&
				globalPlayerStore.isPlayerReady
			) {
				const duration = globalPlayerStore.youtubePlayerInstance.getDuration();
				const position =
					globalPlayerStore.youtubePlayerInstance.getCurrentTime() || 0;

				if (duration && duration > 0) {
					navigator.mediaSession.setPositionState({
						duration: duration,
						playbackRate: 1,
						position: position,
					});
				}
			}
		} catch (error) {
			// Silently fail
		}
	};

	// Update Media Session playback state
	const updateMediaSessionPlaybackState = (
		state: "playing" | "paused" | "none",
	): void => {
		if (!process.client || !("mediaSession" in navigator)) return;
		navigator.mediaSession.playbackState = state;
	};

	// Initialize settings on store creation
	loadSettings();

	// Setup global listeners when in client
	if (process.client) {
		setupGlobalListeners();
		setupMediaSession();
	}

	return {
		// State
		settings: readonly(settings),
		shortcutsEnabled: readonly(shortcutsEnabled),
		viewMode,
		videoPlayerPosition,

		// Computed
		currentKeyboardShortcuts,
		availableShortcutSchemes,

		// Actions
		setKeyboardShortcutScheme,
		setSelectedPlatforms,
		resetToDefaults,
		loadSettings,
		saveSettings,
		handleKeyboardEvent,
		enableShortcuts,
		disableShortcuts,
		setupGlobalListeners,
		cleanupGlobalListeners,
		setupMediaSession,
		updateMediaSessionMetadata,
		updateMediaSessionPlaybackState,
	};
});

if (import.meta.hot) {
	import.meta.hot.accept(
		acceptHMRUpdate(useUserSettingsStore, import.meta.hot),
	);
}
