<template>
	<div v-if="parsedTitles?.length" class="space-y-4">
		<div class="flex items-center justify-between mb-3">
			<h4 class="text-sm font-medium text-primary-4">
				Parsed Titles ({{ parsedTitles.length }} found)
			</h4>
			<AppBtn
				size="small"
				variant="ghost"
				@click="handleCancel"
				class="text-xs"
			>
				Cancel
			</AppBtn>
		</div>

		<div class="overflow-x-auto">
			<table class="w-full border-collapse text-sm">
				<thead>
					<tr class="border-b border-primary-2/50">
						<th class="text-left p-2 font-medium text-primary-4 text-xs">
							Artist
						</th>
						<th
							class="text-center p-2 font-medium text-primary-4 text-xs w-12"
						></th>
						<th class="text-left p-2 font-medium text-primary-4 text-xs">
							Title
						</th>
						<th class="text-left p-2 font-medium text-primary-4 text-xs">
							Confidence
						</th>
						<th class="text-left p-2 font-medium text-primary-4 text-xs">
							Action
						</th>
					</tr>
				</thead>
				<tbody>
					<tr
						v-for="(parsedTitle, index) in parsedTitles"
						:key="index"
						class="border-b border-primary-2/30 hover:bg-bg-gradient transition-colors"
					>
						<!-- Artist Column -->
						<td class="p-2">
							<input
								v-model="editableData[index]!.artist"
								class="w-full bg-transparent border border-primary-2/50 rounded px-2 py-1 text-primary-4 text-xs focus:border-accent focus:outline-none"
								:placeholder="parsedTitle.artist"
								data-input
								@keydown.stop
							/>
						</td>

						<!-- Swap Button Column -->
						<td class="p-2 text-center">
							<AppBtn
								size="small"
								variant="ghost"
								@click="swapArtistTitle(index)"
								class="!p-1 !min-w-0 hover:bg-accent/20"
								title="Swap artist and title"
							>
								<div class="i-mdi-swap-horizontal text-xs" />
							</AppBtn>
						</td>

						<!-- Title Column -->
						<td class="p-2">
							<input
								v-model="editableData[index]!.title"
								class="w-full bg-transparent border border-primary-2/50 rounded px-2 py-1 text-primary-3 text-xs focus:border-accent focus:outline-none"
								:placeholder="parsedTitle.title"
								data-input
								@keydown.stop
							/>
						</td>

						<!-- Confidence Column -->
						<td class="p-2">
							<div class="flex items-center gap-2">
								<div class="w-12 h-2 bg-primary-1 rounded-full overflow-hidden">
									<div
										class="h-full bg-accent rounded-full transition-all"
										:style="{ width: `${parsedTitle.confidence * 100}%` }"
									/>
								</div>
								<span class="text-xs text-primary-3 font-mono">
									{{ Math.round(parsedTitle.confidence * 100) }}%
								</span>
							</div>
						</td>

						<!-- Action Column -->
						<td class="p-2">
							<AppBtn
								size="small"
								variant="primary"
								:disabled="searchingIndex === index"
								@click="handleSearch(index)"
								class="text-xs"
							>
								<template v-if="searchingIndex === index">
									<div class="i-mdi-loading animate-spin mr-1" />
									Searching...
								</template>
								<template v-else>
									<div class="i-mdi-magnify mr-1" />
									Search
								</template>
							</AppBtn>
						</td>
					</tr>
				</tbody>
			</table>
		</div>

		<div
			v-if="searchingIndex !== null"
			class="text-xs text-primary-3 text-center"
		>
			Searching MusicBrainz for "{{ parsedTitles[searchingIndex]?.artist }} -
			{{ parsedTitles[searchingIndex]?.title }}"...
		</div>

		<!-- Error Display -->
		<div
			v-if="searchError"
			class="mt-3 p-2 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-400 text-center"
		>
			{{ searchError }}
		</div>
	</div>
</template>

<script setup lang="ts">
const props = withDefaults(
	defineProps<{
		parsedTitles?: ParsedTitle[];
		videoId: string;
	}>(),
	{
		parsedTitles: undefined,
	},
);

const emit = defineEmits<{
	searchComplete: [results: any[]];
	searchError: [error: string];
	cancel: [];
}>();

const searchingIndex = ref<number | null>(null);
const searchError = ref<string | null>(null);

// Create editable data for each parsed title
const editableData = ref<Array<{ artist: string; title: string }>>([]);

// Initialize editable data when parsed titles change
watchEffect(() => {
	if (props.parsedTitles) {
		editableData.value = props.parsedTitles.map((parsed) => ({
			artist: parsed.artist,
			title: parsed.title,
		}));
	}
});

// Handle search for a specific parsed title
const handleSearch = async (index: number): Promise<void> => {
	searchingIndex.value = index;

	const searchData = editableData.value[index];
	if (!searchData || !searchData.artist || !searchData.title) {
		searchError.value = "Artist and title are required";
		searchingIndex.value = null;
		return;
	}

	try {
		const response = await $fetch("/api/musicbrainz/search", {
			method: "POST",
			body: {
				artist: searchData.artist,
				title: searchData.title,
			},
		});

		if (response.success && response.results?.length > 0) {
			searchError.value = null; // Clear any previous errors
			emit("searchComplete", response.results);
		} else {
			searchError.value = "No search results found";
			emit("searchError", "No search results found");
		}
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : "Unknown error occurred";
		searchError.value = `Search failed: ${errorMessage}`;
		emit("searchError", `Search failed: ${errorMessage}`);
	} finally {
		searchingIndex.value = null;
	}
};

const handleCancel = (): void => {
	searchError.value = null; // Clear errors when cancelling
	emit("cancel");
};

// Handle swapping artist and title for a specific row
const swapArtistTitle = (index: number): void => {
	const data = editableData.value[index];
	if (data) {
		const temp = data.artist;
		data.artist = data.title;
		data.title = temp;
	}
};
</script>
