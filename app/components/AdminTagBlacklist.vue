<template>
	<div class="rounded-lg shadow-sm">
		<div class="flex items-center justify-between mb-4">
			<h2 class="text-xl font-semibold flex items-center gap-2">
				<div class="i-mdi-tag-multiple" />
				Tag Blacklist Management
			</h2>
			<AppBtn
				icon="i-mdi-refresh"
				size="small"
				:loading="loading"
				@click="loadTags"
			>
				Refresh
			</AppBtn>
		</div>

		<div v-if="loading" class="text-center py-8">
			<div class="i-mdi-loading animate-spin text-2xl mb-2" />
			<p class="">Loading tags...</p>
		</div>

		<div
			v-else-if="error"
			class="rounded-lg p-4 mb-6 bg-red-900/20 border border-red-500/30"
		>
			<div class="flex items-center gap-2 text-red-400">
				<div class="i-mdi-alert-circle" />
				<strong>Error:</strong> {{ error }}
			</div>
		</div>

		<div v-else class="space-y-6">
			<!-- Success Message -->
			<div
				v-if="success"
				class="rounded-lg p-4 bg-green-900/20 border border-green-500/30"
			>
				<div class="flex items-center gap-2 text-green-400">
					<div class="i-mdi-check-circle" />
					<strong>Success:</strong> {{ success }}
				</div>
			</div>

			<!-- Statistics -->
			<div class="flex gap-4 text-sm">
				<div class="flex items-center gap-2">
					<div class="i-mdi-tag text-primary-3" />
					<span>{{ availableTags.length }} total tags</span>
				</div>
				<div class="flex items-center gap-2">
					<div class="i-mdi-block-helper text-red-400" />
					<span>{{ blacklistedTags.length }} blacklisted</span>
				</div>
			</div>

			<!-- Search Filter -->
			<div class="mb-4">
				<AppInputText
					id="tagFilter"
					v-model="tagFilter"
					label="Filter tags"
					placeholder="Search tags..."
					icon="i-mdi-magnify"
					class="max-w-md"
				/>
			</div>

			<!-- Available Tags Section -->
			<div>
				<h3 class="text-lg font-medium mb-3 flex items-center gap-2">
					<div class="i-mdi-tag-outline" />
					Available Tags ({{ filteredAvailableTags.length }})
				</h3>

				<div v-if="filteredAvailableTags.length === 0" class="text-center py-8">
					<div class="i-mdi-tag-off text-4xl mb-2" />
					<p class="">No tags found matching your filter.</p>
				</div>

				<div
					v-else
					class="flex flex-wrap gap-2 max-h-96 overflow-y-auto p-4 bg-primary-1 rounded-lg"
				>
					<button
						v-for="tag in filteredAvailableTags"
						:key="tag"
						class="inline-flex items-center gap-1 px-3 py-1 text-sm rounded-full transition-colors bg-primary-2 text-primary-4 hover:bg-red-600 hover:text-white border border-primary-3"
						@click="addToBlacklist(tag)"
					>
						{{ tag }}
						<div class="i-mdi-plus text-xs" />
					</button>
				</div>
			</div>

			<!-- Blacklisted Tags Section -->
			<div>
				<h3 class="text-lg font-medium mb-3 flex items-center gap-2">
					<div class="i-mdi-block-helper text-red-400" />
					Blacklisted Tags ({{ filteredBlacklistedTags.length }})
				</h3>

				<div
					v-if="filteredBlacklistedTags.length === 0"
					class="text-center py-8"
				>
					<div class="i-mdi-tag-check text-4xl mb-2" />
					<p class="">
						No blacklisted tags{{ tagFilter ? " matching your filter" : "" }}.
					</p>
				</div>

				<div
					v-else
					class="flex flex-wrap gap-2 max-h-96 overflow-y-auto p-4 bg-red-900/10 rounded-lg border border-red-500/20"
				>
					<button
						v-for="tag in filteredBlacklistedTags"
						:key="tag"
						class="inline-flex items-center gap-1 px-3 py-1 text-sm rounded-full transition-colors bg-red-600 text-white hover:bg-green-600 border border-red-500"
						@click="removeFromBlacklist(tag)"
					>
						{{ tag }}
						<div class="i-mdi-close text-xs" />
					</button>
				</div>
			</div>

			<!-- Actions -->
			<div class="flex items-center gap-3 pt-4 border-t border-primary-2">
				<AppBtn
					icon="i-mdi-content-save"
					:loading="saving"
					:disabled="!hasChanges"
					@click="saveBlacklist"
				>
					Save Changes
				</AppBtn>
				<AppBtn
					icon="i-mdi-undo"
					variant="ghost"
					:disabled="!hasChanges"
					@click="resetChanges"
				>
					Reset Changes
				</AppBtn>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import type { TagsResponse, UpdateTagsResponse } from "~/types";

// Reactive data
const loading = ref<boolean>(true);
const saving = ref<boolean>(false);
const error = ref<string>("");
const success = ref<string>("");
const tagFilter = ref<string>("");

const availableTags = ref<string[]>([]);
const blacklistedTags = ref<string[]>([]);
const originalBlacklistedTags = ref<string[]>([]);

// Computed properties
const filteredAvailableTags = computed(() => {
	const filter = tagFilter.value.toLowerCase().trim();
	const available = availableTags.value.filter(
		(tag) => !blacklistedTags.value.includes(tag),
	);

	if (!filter) return available;
	return available.filter((tag) => tag.toLowerCase().includes(filter));
});

const filteredBlacklistedTags = computed(() => {
	const filter = tagFilter.value.toLowerCase().trim();

	if (!filter) return blacklistedTags.value;
	return blacklistedTags.value.filter((tag) =>
		tag.toLowerCase().includes(filter),
	);
});

const hasChanges = computed(() => {
	const current = [...blacklistedTags.value].sort();
	const original = [...originalBlacklistedTags.value].sort();
	return JSON.stringify(current) !== JSON.stringify(original);
});

// Methods
const loadTags = async (): Promise<void> => {
	try {
		loading.value = true;
		error.value = "";
		success.value = "";

		const response = await $fetch<TagsResponse>("/api/playlists/tags");

		if (response.success) {
			availableTags.value = response.data.availableTags;
			blacklistedTags.value = [...response.data.blacklistedTags];
			originalBlacklistedTags.value = [...response.data.blacklistedTags];
		} else {
			throw new Error("Failed to load tags");
		}
	} catch (err: any) {
		console.error("Error loading tags:", err);
		error.value = err.message || "Failed to load tags";
	} finally {
		loading.value = false;
	}
};

const addToBlacklist = (tag: string): void => {
	if (!blacklistedTags.value.includes(tag)) {
		blacklistedTags.value.push(tag);
		blacklistedTags.value.sort();
	}
	clearMessages();
};

const removeFromBlacklist = (tag: string): void => {
	const index = blacklistedTags.value.indexOf(tag);
	if (index > -1) {
		blacklistedTags.value.splice(index, 1);
	}
	clearMessages();
};

const saveBlacklist = async (): Promise<void> => {
	try {
		saving.value = true;
		error.value = "";
		success.value = "";

		const response = await $fetch<UpdateTagsResponse>("/api/playlists/tags", {
			method: "POST",
			body: {
				blacklistedTags: blacklistedTags.value,
			},
		});

		if (response.success) {
			originalBlacklistedTags.value = [...blacklistedTags.value];
			success.value = response.message;
		} else {
			throw new Error("Failed to save blacklist");
		}
	} catch (err: any) {
		console.error("Error saving blacklist:", err);
		error.value =
			err.data?.message || err.message || "Failed to save blacklist";
	} finally {
		saving.value = false;
	}
};

const resetChanges = (): void => {
	blacklistedTags.value = [...originalBlacklistedTags.value];
	clearMessages();
};

const clearMessages = (): void => {
	error.value = "";
	success.value = "";
};

// Load tags on mount
onMounted(async () => {
	await loadTags();
});
</script>
