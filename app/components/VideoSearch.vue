<template>
	<div class="flex flex-col gap-8 sm:gap-12 px-4 sm:px-6">
		<div
			class="flex justify-center items-center gap-4 sm:gap-6 w-full max-w-7xl mx-auto"
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
					icon="i-mdi-filter-variant"
					variant="ghost"
					size="medium"
					@click="toggleFilters"
				>
					<span class="hidden sm:inline">Filters</span>
				</AppBtn>
				<AppBtn
					v-if="isLocalhost"
					to="/admin"
					icon="i-mdi-cog"
					variant="ghost"
					size="medium"
				>
					<span class="hidden sm:inline">Admin</span>
				</AppBtn>
			</div>
		</div>

		<!-- Filter Panel -->
		<div v-if="showFilters" class="rounded-lg p-4 space-y-4">
			<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
				<!-- Artist Filter -->
				<div>
					<AppInputMultiSelect
						id="artist-filter"
						v-model="selectedArtists"
						label="Artists"
						placeholder="Search and select artists..."
						:options="availableArtists"
						help-text="Select multiple artists to filter by"
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
						help-text="Select multiple tags to filter by"
					/>
				</div>

				<!-- Duration Filter -->
				<div>
					<label class="block text-sm font-medium mb-2">Duration</label>
					<div class="flex gap-2">
						<AppBtn
							size="small"
							:variant="selectedDuration === 'short' ? 'primary' : 'ghost'"
							@click="toggleDuration('short')"
						>
							Short (< 4 min)
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
							Long (> 20 min)
						</AppBtn>
					</div>
				</div>
			</div>

			<!-- Sort Options Row -->
			<div class="grid grid-cols-1 md:grid-cols-4 gap-4">
				<div>
					<label class="block text-sm font-medium mb-2">Sort By</label>
					<select
						v-model="sortBy"
						class="w-full rounded-lg bg-primary-1 text-accent border border-primary-2 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
					>
						<option value="relevance">Relevance</option>
						<option value="title">Title A-Z</option>
						<option value="artist">Artist A-Z</option>
						<option value="duration">Duration</option>
					</select>
				</div>
			</div>

			<div class="flex justify-between items-center">
				<span class="text-sm text-primary-3">
					{{ filteredVideos.length }} of {{ totalVideos }} videos
				</span>
				<AppBtn variant="ghost" size="small" @click="clearFilters">
					Clear All
				</AppBtn>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import Fuse from "fuse.js";
import type { Video } from "../types";

interface Props {
	videos: Video[];
}

interface Emits {
	"filtered-videos": [videos: Video[]];
}

const props = withDefaults(defineProps<Props>(), {
	videos: () => [],
});

const emit = defineEmits<Emits>();

// Check if running on localhost
const isLocalhost = ref<boolean>(false);

// Set localhost status on client side
onMounted(() => {
	isLocalhost.value =
		window.location.hostname === "localhost" ||
		window.location.hostname === "127.0.0.1";
});

// Search state
const searchQuery = ref<string>("");
const showFilters = ref<boolean>(false);
const selectedArtists = ref<string[]>([]);
const selectedTags = ref<string[]>([]);
const selectedDuration = ref<string>("");
const sortBy = ref<string>("relevance");

// Computed properties
const totalVideos = computed(() => props.videos.length);

const availableArtists = computed(() => {
	const artists = [
		...new Set(
			props.videos
				.filter((video) => video.artist)
				.map((video) => video.artist!),
		),
	];
	return artists.sort();
});

const availableTags = computed(() => {
	const tags = new Set<string>();
	props.videos.forEach((video) => {
		if (video.tags) {
			video.tags.forEach((tag) => tags.add(tag));
		}
	});
	return Array.from(tags).sort();
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

const fuse = computed(() => new Fuse(props.videos, fuseOptions));

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

// Main filtering logic
const filteredVideos = computed<Video[]>(() => {
	let results: Video[] = [];

	// Start with search results or all videos
	if (searchQuery.value.trim()) {
		const fuseResults = fuse.value.search(searchQuery.value);
		results = fuseResults.map((result) => result.item);
	} else {
		results = [...props.videos];
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

	// Apply duration filter
	results = results.filter(filterByDuration);

	// Apply sorting
	if (sortBy.value !== "relevance" || !searchQuery.value.trim()) {
		results.sort((a, b) => {
			switch (sortBy.value) {
				case "title":
					const titleA = a.musicTitle || a.title;
					const titleB = b.musicTitle || b.title;
					return titleA.localeCompare(titleB);
				case "artist":
					const artistA = a.artist || "Unknown";
					const artistB = b.artist || "Unknown";
					return artistA.localeCompare(artistB);

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

// Toggle duration filter
const toggleDuration = (duration: string): void => {
	if (selectedDuration.value === duration) {
		selectedDuration.value = ""; // Deselect if already selected
	} else {
		selectedDuration.value = duration; // Select new duration
	}
};

const clearFilters = (): void => {
	searchQuery.value = "";
	selectedArtists.value = [];
	selectedTags.value = [];
	selectedDuration.value = "";
	sortBy.value = "relevance";
};

// Emit filtered results whenever they change
watch(
	filteredVideos,
	(newVideos) => {
		emit("filtered-videos", newVideos);
	},
	{ immediate: true },
);
</script>
