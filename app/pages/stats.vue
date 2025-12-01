<template>
	<div class="container mx-auto px-4 py-8 max-w-6xl">
		<div class="flex items-center justify-between mb-8">
			<h1 class="text-3xl font-bold flex items-center gap-3">
				<div class="i-mdi-chart-bar" />
				Statistics
			</h1>
			<AppBtn icon="i-mdi-arrow-left" variant="primary" to="/">
				Back to Playlists
			</AppBtn>
		</div>

		<!-- Loading State -->
		<div v-if="loading" class="flex items-center justify-center py-12">
			<div class="flex items-center gap-3 text-primary-3">
				<div class="i-mdi-loading animate-spin text-2xl" />
				<span>Loading statistics...</span>
			</div>
		</div>

		<!-- Error State -->
		<div
			v-else-if="error"
			class="bg-primary-1 border border-error rounded-lg p-6"
		>
			<div class="flex items-center gap-2 text-error">
				<div class="i-mdi-alert-circle" />
				<strong>Error:</strong> {{ error }}
			</div>
		</div>

		<!-- Stats Content -->
		<div v-else class="space-y-8">
			<!-- Data Sources Section -->
			<section class="bg-bg-gradient rounded-lg p-6">
				<h2 class="text-2xl font-semibold mb-6 flex items-center gap-2">
					<div class="i-mdi-database" />
					Data Sources
				</h2>
				<div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
					<div
						v-for="(source, key) in statsData.sources"
						:key="key"
						class="bg-primary-1 rounded-lg p-4 hover:bg-primary-2 transition-colors"
					>
						<div class="flex items-start justify-between mb-2">
							<h3 class="text-lg font-semibold text-primary-4">
								{{ source.name }}
							</h3>
							<a
								:href="source.url"
								target="_blank"
								rel="noopener noreferrer"
								class="text-accent hover:text-accent-1 transition-colors"
							>
								<div class="i-mdi-open-in-new text-xl" />
							</a>
						</div>
						<p class="text-sm text-primary-3 mb-4">
							{{ source.summary }}
						</p>
						<div class="flex gap-4 text-sm">
							<div v-if="source.items" class="flex items-center gap-1">
								<div class="i-mdi-file-music text-accent" />
								<span class="text-primary-3">{{ source.items }} items</span>
							</div>
							<div v-if="source.tags" class="flex items-center gap-1">
								<div class="i-mdi-tag text-accent" />
								<span class="text-primary-3">{{ source.tags }} tags</span>
							</div>
						</div>
					</div>
				</div>

				<!-- Bar Chart for Sources -->
				<div class="mt-6">
					<h3 class="text-lg font-semibold mb-4">Items per Source</h3>
					<div class="space-y-3">
						<div
							v-for="(source, key) in sortedSources"
							:key="key"
							class="flex items-center gap-3"
						>
							<div class="w-32 text-sm text-primary-3 truncate">
								{{ source.name }}
							</div>
							<div
								class="flex-1 relative h-8 bg-primary-1 rounded-lg overflow-hidden"
							>
								<div
									class="absolute inset-y-0 left-0 bg-accent transition-all duration-500 flex items-center justify-end pr-2"
									:style="{ width: getBarWidth(source.items || 0, maxSourceItems) }"
								>
									<span class="text-xs font-semibold text-primary-1">
										{{ source.items }}
									</span>
								</div>
							</div>
						</div>
					</div>
				</div>
			</section>

			<!-- Playlist Section -->
			<section class="bg-bg-gradient rounded-lg p-6">
				<h2 class="text-2xl font-semibold mb-6 flex items-center gap-2">
					<div class="i-mdi-playlist-music" />
					Playlist Overview
				</h2>

				<!-- Playlist Summary Stats -->
				<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
					<div class="bg-primary-1 rounded-lg p-4 text-center">
						<div class="text-3xl font-bold text-accent mb-1">
							{{ statsData.playlist.items }}
						</div>
						<div class="text-sm text-primary-3">Total Songs</div>
					</div>
					<div class="bg-primary-1 rounded-lg p-4">
						<div class="text-sm font-medium text-primary-3 mb-3 text-center">
							Tags Coverage
						</div>
						<div class="flex items-center justify-between">
							<div class="text-center flex-1">
								<div class="text-2xl font-bold text-accent mb-1">
									{{ statsData.playlist.itemsWithTags }}
								</div>
								<div class="text-xs text-primary-3">Songs</div>
							</div>
							<div class="text-center flex-1">
								<div class="text-2xl font-bold text-accent mb-1">
									{{ playlistTagsPercentage }}%
								</div>
								<div class="text-xs text-primary-3">Coverage</div>
							</div>
						</div>
					</div>
					<div class="bg-primary-1 rounded-lg p-4">
						<div class="text-sm font-medium text-primary-3 mb-3 text-center">
							External IDs Coverage
						</div>
						<div class="flex items-center justify-between">
							<div class="text-center flex-1">
								<div class="text-2xl font-bold text-accent mb-1">
									{{ statsData.playlist.itemsWithExternalIds }}
								</div>
								<div class="text-xs text-primary-3">Songs</div>
							</div>
							<div class="text-center flex-1">
								<div class="text-2xl font-bold text-accent mb-1">
									{{ playlistExternalIdsPercentage }}%
								</div>
								<div class="text-xs text-primary-3">Coverage</div>
							</div>
						</div>
					</div>
				</div>

				<!-- Playlist External Links with Percentages -->
				<div>
					<h3 class="text-lg font-semibold mb-4">Platform Coverage</h3>
					<p class="text-sm text-primary-3 mb-4">
						Percentage of playlist songs available on each platform
					</p>
					<div class="space-y-2">
						<div
							v-for="platform in sortedPlaylistPlatforms"
							:key="platform.key"
							class="flex items-center gap-3"
						>
							<div class="w-40 text-sm text-primary-3 truncate">
								{{ formatPlatformName(platform.key) }}
							</div>
							<div
								class="flex-1 relative h-7 bg-primary-1 rounded-lg overflow-hidden"
							>
								<div
									class="absolute inset-y-0 left-0 transition-all duration-500 flex items-center justify-end pr-2"
									:class="
										getTagBarColor(platform.count, statsData.playlist.items)
									"
									:style="{
										width: getBarWidth(
											platform.count,
											statsData.playlist.items,
										),
									}"
								>
									<span class="text-xs font-semibold text-primary-1">
										{{ platform.count }}
									</span>
								</div>
							</div>
							<div class="w-20 text-right text-sm text-primary-3">
								{{ getPercentage(platform.count, statsData.playlist.items) }}%
							</div>
						</div>
					</div>
				</div>
			</section>

			<!-- Tag Statistics Section -->
			<section class="bg-bg-gradient rounded-lg p-6">
				<h2 class="text-2xl font-semibold mb-6 flex items-center gap-2">
					<div class="i-mdi-tag-multiple" />
					Tag Statistics
				</h2>

				<!-- Top 50 Tags -->
				<div class="mb-8">
					<h3 class="text-lg font-semibold mb-4">Top 50 Tags</h3>
					<div class="space-y-2">
						<div
							v-for="tag in statsData.playlist.topTags"
							:key="tag.tag"
							class="flex items-center gap-3"
						>
							<div class="w-32 text-sm text-primary-3 truncate">
								{{ tag.tag }}
							</div>
							<div
								class="flex-1 relative h-7 bg-primary-1 rounded-lg overflow-hidden"
							>
								<div
									class="absolute inset-y-0 left-0 transition-all duration-500 flex items-center justify-end pr-2"
									:class="getTagBarColor(tag.count, maxTagCount)"
									:style="{ width: getBarWidth(tag.count, maxTagCount) }"
								>
									<span class="text-xs font-semibold text-primary-1">
										{{ tag.count }}
									</span>
								</div>
							</div>
						</div>
					</div>
				</div>

				<!-- Top Tags by User -->
				<div>
					<h3 class="text-lg font-semibold mb-4">Top Tags by User</h3>
					<div class="space-y-6">
						<div 
							v-for="userId in sortedUsers"
							:key="userId"
							class="bg-primary-1 rounded-lg p-4"
						>
							<div
								class="font-medium text-primary-4 mb-3 flex items-center justify-between"
							>
								<div class="flex items-center gap-3">
									<div
										class="w-10 h-10 rounded-full flex items-center justify-center"
										:style="{ backgroundColor: getUserColor(userId) }"
									>
										<div class="i-mdi-account text-2xl text-primary-1" />
									</div>
									<span class="text-sm text-primary-3">
										{{ statsData.playlist.topTagsByUser[userId]!.totalSongs }}
										songs
									</span>
								</div>
							</div>
							<div class="space-y-2">
								<div
									v-for="tag in statsData.playlist.topTagsByUser[userId]!.tags"
									:key="tag.tag"
									class="flex items-center gap-3"
								>
									<div class="w-24 text-sm text-primary-3 truncate">
										{{ tag.tag }}
									</div>
									<div class="flex-1 relative h-6 rounded-lg overflow-hidden">
										<div
											class="absolute inset-y-0 left-0 transition-all duration-500 flex items-center justify-end pr-2"
											:class="
												getTagBarColor(
													tag.count,
													statsData.playlist.topTagsByUser[userId]!.tags[0]!
														.count,
												)
											"
											:style="{
												width: getBarWidth(
													tag.count,
													statsData.playlist.topTagsByUser[userId]!.tags[0]!
														.count,
												),
											}"
										>
											<span class="text-xs font-semibold text-primary-1">
												{{ tag.count }}
											</span>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</section>
		</div>
	</div>
</template>

<script setup lang="ts">
interface Source {
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
}

interface StatsData {
	sources: Record<string, Source>;
	playlist: PlaylistData;
}

// Page metadata
useHead({
	title: "Statistics - Music Playlist View",
	meta: [
		{ name: "description", content: "View statistics about your music data" },
	],
});

// Reactive data
const loading = ref(true);
const error = ref<string>("");
const statsData = ref<StatsData>({
	sources: {},
	playlist: {
		items: 0,
		itemsWithTags: 0,
		itemsWithExternalIds: 0,
		externalIdsByPlatform: {},
		topTags: [],
		topTagsByUser: {},
	},
});

// Load stats data on mount
onMounted(async () => {
	try {
		loading.value = true;
		const data = await $fetch<StatsData>("/stats/sources.json");
		statsData.value = data;
	} catch (err: any) {
		console.error("Error loading stats:", err);
		error.value = "Failed to load statistics data";
	} finally {
		loading.value = false;
	}
});

// Computed properties for data sources
const sortedSources = computed(() => {
	return Object.entries(statsData.value.sources)
		.filter(([_, source]) => source.items && source.items > 0)
		.map(([key, source]) => ({ key, ...source }))
		.sort((a, b) => (b.items || 0) - (a.items || 0));
});

const maxSourceItems = computed(() => {
	return Math.max(
		...Object.values(statsData.value.sources)
			.map((s) => s.items || 0)
			.filter((n) => n > 0),
		1,
	);
});

// Computed properties for playlist
const playlistTagsPercentage = computed(() => {
	const total = statsData.value.playlist.items;
	const withTags = statsData.value.playlist.itemsWithTags;
	return total > 0 ? ((withTags / total) * 100).toFixed(1) : "0";
});

const playlistExternalIdsPercentage = computed(() => {
	const total = statsData.value.playlist.items;
	const withExternalIds = statsData.value.playlist.itemsWithExternalIds;
	return total > 0 ? ((withExternalIds / total) * 100).toFixed(1) : "0";
});

const sortedPlaylistPlatforms = computed(() => {
	return Object.entries(statsData.value.playlist.externalIdsByPlatform)
		.map(([key, count]) => ({ key, count }))
		.sort((a, b) => b.count - a.count);
});

const sortedUsers = computed(() => {
	return Object.entries(statsData.value.playlist.topTagsByUser)
		.sort(([, a], [, b]) => b.totalSongs - a.totalSongs)
		.map(([userId]) => userId);
});

const maxTagCount = computed(() => {
	return Math.max(...statsData.value.playlist.topTags.map((t) => t.count), 1);
});

const getTagBarColor = (count: number, max: number): string => {
	const percentage = max > 0 ? count / max : 0;
	// Create gradient from dim to full accent based on count
	if (percentage > 0.7) return "bg-accent";
	if (percentage > 0.4) return "bg-accent-1";
	return "bg-accent-2";
};

// Helper functions
const getBarWidth = (value: number, max: number): string => {
	const percentage = max > 0 ? (value / max) * 100 : 0;
	return `${Math.max(percentage, 2)}%`; // Minimum 2% for visibility
};

const getPercentage = (value: number, total: number): string => {
	return total > 0 ? ((value / total) * 100).toFixed(1) : "0";
};

const formatPlatformName = (key: string): string => {
	// Convert camelCase to Title Case with spaces
	const formatted = key
		.replace(/([A-Z])/g, " $1")
		.replace(/^./, (str) => str.toUpperCase())
		.trim();

	// Special cases
	const specialCases: Record<string, string> = {
		Lastfm: "Last.fm",
		Youtube: "YouTube",
		"Youtube Music": "YouTube Music",
		Itunes: "iTunes",
		"Amazon Music": "Amazon Music",
		"Amazon Store": "Amazon Store",
		"Apple Music": "Apple Music",
		"Musicbrainz Track": "MusicBrainz Track",
		"Musicbrainz Artist": "MusicBrainz Artist",
	};

	return specialCases[formatted] || formatted;
};
</script>
