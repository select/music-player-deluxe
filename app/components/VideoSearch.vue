<template>
	<div
		class="fixed top-6 left-0 flex flex-col gap-8 sm:gap-12 px-4 sm:px-6 z-1 w-full"
	>
		<div
			class="backdrop-blur-3xl rounded-2xl flex justify-center items-center gap-4 sm:gap-6 w-full max-w-2xl mx-auto pl-3"
		>
			<div class="flex-1 min-w-0 overflow-hidden">
				<AppInputText
					id="search"
					v-model="searchQuery"
					placeholder="Search by title, artist, or tags..."
					size="large"
				/>
			</div>
			<div class="flex gap-2 sm:gap-3 items-center flex-shrink-0">
				<AppBtn
					icon="i-mdi-filter-variant text-3xl"
					variant="ghost"
					size="large"
					class="rounded-full"
					:class="{ '[&_[class^=i-mdi]]:text-accent': hasActiveFilters }"
					@click="toggleFilters"
				/>

				<AppBtn
					:icon="getViewModeIcon()"
					variant="ghost"
					size="large"
					class="rounded-full text-2xl"
					@click="cycleViewMode"
				/>

				<AppBtn
					v-if="isLocalhost"
					to="/admin"
					icon="i-mdi-cog"
					variant="ghost"
					size="medium"
					class="lt-sm:hidden"
				>
					<span class="hidden sm:inline">Admin</span>
				</AppBtn>
			</div>
		</div>

		<!-- Filter Panel -->
		<div
			v-if="showFilters"
			class="rounded-lg p-4 space-y-4 backdrop-blur-2xl bg-bg-gradient"
		>
			<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
				<!-- Artist Filter -->
				<div>
					<AppInputMultiSelect
						id="artist-filter"
						v-model="selectedArtists"
						label="Artists"
						placeholder="Search and select artists..."
						:options="availableArtists"
					/>
				</div>

				<!-- Tag Filter -->
				<div>
					<AppInputMultiSelect
						id="tag-filter"
						v-model="selectedTags"
						label="Tags"
						placeholder="Search and select tags..."
						:options="availableTags"
					/>
				</div>

				<!-- Duration Filter -->
				<div>
					<label class="block text-sm font-medium mb-2">Duration</label>
					<div class="flex flex-wrap gap-2">
						<AppBtn
							size="small"
							:variant="selectedDuration === 'short' ? 'primary' : 'ghost'"
							@click="toggleDuration('short')"
						>
							Short (&lt; 4 min)
						</AppBtn>
						<AppBtn
							size="small"
							:variant="selectedDuration === 'medium' ? 'primary' : 'ghost'"
							@click="toggleDuration('medium')"
						>
							Medium (4-20 min)
						</AppBtn>
						<AppBtn
							size="small"
							:variant="selectedDuration === 'long' ? 'primary' : 'ghost'"
							@click="toggleDuration('long')"
						>
							Long (&gt; 20 min)
						</AppBtn>
					</div>
				</div>
			</div>

			<!-- Users Filter -->
			<div class="grid grid-cols-1 gap-4">
				<div>
					<label class="block text-sm font-medium mb-2">Users</label>
					<div class="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
						<div
							v-for="user in availableUsers"
							:key="user.userId"
							class="flex items-center gap-2 cursor-pointer p-2 hover:bg-primary-1 rounded-2xl transition-colors"
							:class="{
								'bg-primary-2': selectedUsers.includes(user.userId),
							}"
							@click="toggleUser(user.userId)"
						>
							<div
								class="w-4 h-4 rounded-full flex items-center justify-center text-black text-xs font-bold"
								:style="{ backgroundColor: user.color }"
							>
								<span class="i-mdi-account text-xs" />
							</div>

							<span class="text-xs text-primary-3 px-2 py-1 rounded-full">
								{{ user.count }}
							</span>
						</div>
					</div>
				</div>
			</div>

			<!-- Platforms Filter -->
			<div class="grid grid-cols-1 gap-4">
				<div>
					<label class="block text-sm font-medium mb-2">Music Platforms</label>
					<div class="flex flex-wrap gap-2">
						<AppBtn
							v-for="platform in getAllPlatforms()"
							:key="platform.id"
							size="small"
							:variant="
								settings.selectedPlatforms?.includes(platform.id)
									? 'primary'
									: 'ghost'
							"
							@click="togglePlatform(platform.id)"
						>
							<div :class="platform.icon" class="text-sm mr-1" />
							{{ platform.name }}
						</AppBtn>
					</div>
				</div>
			</div>

			<!-- Sort Options and Settings Row -->
			<div class="grid grid-cols-1 md:grid-cols-4 gap-4">
				<div>
					<label class="block text-sm font-medium mb-2">Sort By</label>
					<select
						v-model="sortBy"
						class="w-full rounded-lg bg-primary-1 text-primary-3 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
						@keydown.stop
					>
						<option value="relevance">Relevance</option>
						<option value="createdAt">Date Added (Latest First)</option>
						<option value="title">Title A-Z</option>
						<option value="artist">Artist A-Z</option>
						<option value="duration">Duration</option>
					</select>
				</div>

				<!-- Shuffle Button -->
				<div>
					<label class="block text-sm font-medium mb-2">Playlist</label>
					<AppBtn
						icon="i-mdi-shuffle"
						variant="primary"
						size="medium"
						class="w-full"
						@click="shufflePlaylist"
					>
						Shuffle
					</AppBtn>
				</div>

				<!-- Keyboard Shortcuts -->
				<div>
					<div class="flex justify-between">
						<label class="block text-sm font-medium mb-2">Keyboard </label>
						<AppBtn
							icon="i-mdi-keyboard"
							variant="ghost"
							size="medium"
							@click="toggleKeyboardHelp"
						>
							<span class="hidden sm:inline">Shortcuts</span>
						</AppBtn>
					</div>
					<select
						:value="settings.keyboardShortcutScheme"
						class="w-full rounded-lg bg-primary-1 text-primary-3 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
						@change="
							setKeyboardShortcutScheme(
								($event.target as HTMLSelectElement)
									.value as KeyboardShortcutScheme,
							)
						"
						@keydown.stop
					>
						<option
							v-for="scheme in availableShortcutSchemes"
							:key="scheme.value"
							:value="scheme.value"
						>
							{{ scheme.label }}
						</option>
					</select>
				</div>
				<div class="text-primary-3 w-full text-right">Scroll to close.</div>
			</div>

			<div class="flex justify-between items-center">
				<span class="text-sm text-primary-3">
					{{ filteredVideos.length }} of {{ totalVideos }} videos
				</span>
				<div class="flex gap-2">
					<AppBtn
						to="/stats"
						icon="i-mdi-chart-bar"
						variant="ghost"
						size="small"
					>
						Stats
					</AppBtn>
					<AppBtn variant="ghost" size="small" @click="clearFilters">
						Clear All
					</AppBtn>
				</div>
			</div>
		</div>

		<!-- Keyboard Shortcuts Help Modal -->
		<KeyboardShortcutsHelp
			:show-help="showKeyboardHelp"
			@close="showKeyboardHelp = false"
		/>
	</div>
</template>

<script setup lang="ts">
import Fuse from "fuse.js";
import type { Video, KeyboardShortcutScheme } from "../types";

// Stores
const { setCurrentPlaylistVideos } = usePlaylistStore();
const { setKeyboardShortcutScheme, setSelectedPlatforms } =
	useUserSettingsStore();
const { originalCurrentPlaylist } = storeToRefs(usePlaylistStore());
const { settings, availableShortcutSchemes, viewMode } = storeToRefs(
	useUserSettingsStore(),
);

// Timeline scale state

// Check if running on localhost
const isLocalhost = ref<boolean>(false);

// Scroll tracking for filter panel closing
let lastScrollPosition = 0;
let scrollTimeout: ReturnType<typeof setTimeout> | null = null;

const handleScroll = () => {
	const currentScrollPosition = window.scrollY;

	// Clear existing timeout
	if (scrollTimeout) {
		clearTimeout(scrollTimeout);
	}

	// Set a timeout to detect when scrolling has stopped
	scrollTimeout = setTimeout(() => {
		// Calculate distance scrolled from last stop position
		const scrollDistance = Math.abs(currentScrollPosition - lastScrollPosition);

		// Close filter panel if scrolled more than 500px from last stop
		if (scrollDistance > 500 && showFilters.value) {
			showFilters.value = false;
		}

		// Update last scroll position
		lastScrollPosition = currentScrollPosition;
	}, 150); // Wait 150ms after scrolling stops
};

// Set localhost status on client side
onMounted(() => {
	isLocalhost.value =
		window.location.hostname === "localhost" ||
		window.location.hostname === "127.0.0.1";

	// Initialize scroll position and add listener
	lastScrollPosition = window.scrollY;
	window.addEventListener("scroll", handleScroll);
});

// Clean up scroll listener and timeout
onUnmounted(() => {
	window.removeEventListener("scroll", handleScroll);
	if (scrollTimeout) {
		clearTimeout(scrollTimeout);
	}
});

// Search state
const searchQuery = ref<string>("");
const showFilters = ref<boolean>(false);
const selectedArtists = ref<string[]>([]);
const selectedTags = ref<string[]>([]);
const selectedUsers = ref<string[]>([]);
const selectedDuration = ref<string>("");
const sortBy = ref<string>("createdAt");
const showKeyboardHelp = ref<boolean>(false);
const isShuffled = ref<boolean>(false);

// Get original videos from store
const originalVideos = computed(
	() => originalCurrentPlaylist.value?.videos || [],
);

// Computed properties
const totalVideos = computed(() => originalVideos.value.length);

const hasActiveFilters = computed(() => {
	return (
		selectedArtists.value.length > 0 ||
		selectedTags.value.length > 0 ||
		selectedUsers.value.length > 0 ||
		selectedDuration.value !== "" ||
		searchQuery.value.trim() !== ""
	);
});

const availableArtists = computed(() => {
	const artists = [
		...new Set(
			originalVideos.value
				.filter((video) => video.artist)
				.map((video) => video.artist!),
		),
	];
	return artists.sort();
});

const availableTags = computed(() => {
	const tags = new Set<string>();
	originalVideos.value.forEach((video) => {
		if (video.tags) {
			video.tags.forEach((tag) => tags.add(tag));
		}
	});
	return Array.from(tags).sort();
});

const availableUsers = computed(() => {
	// Get unique users from videos array with their video counts
	const userCounts = new Map<string | null, number>();

	originalVideos.value.forEach((video) => {
		const userId = video.userId || null;
		userCounts.set(userId, (userCounts.get(userId) || 0) + 1);
	});

	return Array.from(userCounts.entries())
		.map(([userId, count]) => ({
			userId: userId || "Anonymous",
			originalUserId: userId,
			count,
			color: userId ? getUserColor(userId) : "#666666", // Gray color for anonymous users
		}))
		.sort((a, b) => b.count - a.count); // Sort by count descending
});

// Fuse.js configuration
const fuseOptions = {
	keys: [
		{ name: "title", weight: 0.3 },
		{ name: "musicTitle", weight: 0.4 },
		{ name: "artist", weight: 0.4 },
		{ name: "tags", weight: 0.2 },
		{ name: "description", weight: 0.1 },
	],
	threshold: 0.3,
	includeScore: true,
	minMatchCharLength: 2,
};

const fuse = computed(() => new Fuse(originalVideos.value, fuseOptions));

// Duration helper function
const parseDuration = (duration: string): number => {
	if (!duration) return 0;

	const parts = duration.split(":").map(Number);
	if (parts.length === 2 && parts[0] !== undefined && parts[1] !== undefined) {
		return parts[0] * 60 + parts[1]; // MM:SS
	} else if (
		parts.length === 3 &&
		parts[0] !== undefined &&
		parts[1] !== undefined &&
		parts[2] !== undefined
	) {
		return parts[0] * 3600 + parts[1] * 60 + parts[2]; // HH:MM:SS
	}
	return 0;
};

const filterByDuration = (video: Video): boolean => {
	if (!selectedDuration.value) return true;

	const durationSeconds = parseDuration(video.duration);
	const durationMinutes = durationSeconds / 60;

	switch (selectedDuration.value) {
		case "short":
			return durationMinutes < 4;
		case "medium":
			return durationMinutes >= 4 && durationMinutes <= 20;
		case "long":
			return durationMinutes > 20;
		default:
			return true;
	}
};

// Toggle user filter
const toggleUser = (userId: string): void => {
	const index = selectedUsers.value.indexOf(userId);
	if (index > -1) {
		selectedUsers.value.splice(index, 1);
	} else {
		selectedUsers.value.push(userId);
	}
};

// Main filtering logic
const filteredVideos = computed<Video[]>(() => {
	let results: Video[] = [];

	// Start with search results or all videos
	if (searchQuery.value.trim()) {
		const fuseResults = fuse.value.search(searchQuery.value);
		results = fuseResults.map((result) => result.item);
	} else {
		results = [...originalVideos.value];
	}

	// Apply artist filter
	if (selectedArtists.value.length > 0) {
		results = results.filter(
			(video) => video.artist && selectedArtists.value.includes(video.artist),
		);
	}

	// Apply tag filter
	if (selectedTags.value.length > 0) {
		results = results.filter(
			(video) =>
				video.tags &&
				selectedTags.value.some((tag) => video.tags!.includes(tag)),
		);
	}

	// Apply user filter
	if (selectedUsers.value.length > 0) {
		results = results.filter((video) => {
			const userIdToCheck = video.userId || "Anonymous";
			return selectedUsers.value.includes(userIdToCheck);
		});
	}

	// Apply duration filter
	results = results.filter(filterByDuration);

	// Apply sorting
	if (sortBy.value !== "relevance" || !searchQuery.value.trim()) {
		results.sort((a, b) => {
			switch (sortBy.value) {
				case "createdAt":
					// Videos with createdAt come first
					if (a.createdAt && !b.createdAt) return -1;
					if (!a.createdAt && b.createdAt) return 1;
					// Both have createdAt, sort by latest first
					if (a.createdAt && b.createdAt) {
						return b.createdAt - a.createdAt;
					}
					return 0;
				case "title": {
					const titleA = a.musicTitle || a.title;
					const titleB = b.musicTitle || b.title;
					return titleA.localeCompare(titleB);
				}
				case "artist": {
					const artistA = a.artist || "Unknown";
					const artistB = b.artist || "Unknown";
					return artistA.localeCompare(artistB);
				}
				case "duration":
					return parseDuration(a.duration) - parseDuration(b.duration);
				default:
					return 0;
			}
		});
	}

	return results;
});

// Methods
const toggleFilters = (): void => {
	showFilters.value = !showFilters.value;
};

const toggleKeyboardHelp = (): void => {
	showKeyboardHelp.value = !showKeyboardHelp.value;
};

// Toggle duration filter
const toggleDuration = (duration: string): void => {
	if (selectedDuration.value === duration) {
		selectedDuration.value = ""; // Deselect if already selected
	} else {
		selectedDuration.value = duration; // Select new duration
	}
};

// Toggle platform filter
const togglePlatform = (platformId: string): void => {
	const currentSelected = settings.value.selectedPlatforms || [];
	const isSelected = currentSelected.includes(platformId);

	if (isSelected) {
		setSelectedPlatforms(currentSelected.filter((id) => id !== platformId));
	} else {
		setSelectedPlatforms([...currentSelected, platformId]);
	}
};

const clearFilters = (): void => {
	searchQuery.value = "";
	selectedArtists.value = [];
	selectedTags.value = [];
	selectedUsers.value = [];
	selectedDuration.value = "";
	sortBy.value = "createdAt";
	isShuffled.value = false;
};

// Shuffle array using Fisher-Yates algorithm
const shuffleArray = <T,>(array: T[]): T[] => {
	const shuffled = [...array];
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
	}
	return shuffled;
};

const shufflePlaylist = (): void => {
	const shuffled = shuffleArray(filteredVideos.value);
	setCurrentPlaylistVideos(shuffled);
};

// View mode cycling
const cycleViewMode = (): void => {
	if (viewMode.value === "grid") {
		viewMode.value = "list";
	} else if (viewMode.value === "list") {
		viewMode.value = "timeline";
	} else {
		viewMode.value = "grid";
	}
};

// Get view mode icon
const getViewModeIcon = (): string => {
	switch (viewMode.value) {
		case "grid":
			return "i-mdi-view-grid";
		case "list":
			return "i-mdi-view-list";
		case "timeline":
			return "i-mdi-timeline";
		default:
			return "i-mdi-view-grid";
	}
};

// Update the store whenever filtered results change
watch(
	filteredVideos,
	(newVideos) => {
		setCurrentPlaylistVideos(newVideos);
	},
	{ immediate: true },
);
</script>
