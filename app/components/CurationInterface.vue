<template>
	<div class="space-y-4">
		<div class="flex items-center justify-between mb-4">
			<h3 class="text-xl font-semibold text-primary-4">
				Choose Artist & Title
			</h3>
			<AppBtn
				v-if="!saving"
				variant="secondary"
				icon="i-mdi-close"
				@click="$emit('cancel')"
			>
				Skip
			</AppBtn>
		</div>

		<!-- Dynamic Options -->
		<div
			v-for="option in availableOptions"
			:key="option.key"
			class="bg-primary-1 rounded-lg pl-3"
		>
			<div class="flex items-center gap-3">
				<div class="flex-1 flex items-center gap-3">
					<AppInputText
						v-model="option.data.artist"
						placeholder="Artist"
						size="small"
						label="Artist"
						class="flex-1"
					/>
					<button
						:disabled="saving"
						class="w-10 h-10 flex items-center justify-center rounded-full transition-all"
						:class="
							saving
								? 'text-primary-3 cursor-not-allowed'
								: 'text-primary-3 hover:text-primary-4 hover:bg-primary-2'
						"
						title="Swap artist and title"
						@click="swapFields(option.data)"
					>
						<div class="i-mdi-swap-horizontal text-xl" />
					</button>
					<AppInputText
						v-model="option.data.title"
						placeholder="Title"
						size="small"
						label="Title"
						class="flex-1"
					/>
				</div>
				<button
					:disabled="saving"
					class="w-12 h-12 flex items-center justify-center rounded-full transition-all"
					:class="
						saving
							? 'text-primary-3 cursor-not-allowed'
							: 'text-primary-3 hover:text-accent hover:bg-accent/10 hover:scale-110'
					"
					title="Save this option"
					@click="submitCuration(option.key, option.data)"
				>
					<div v-if="saving" class="i-mdi-loading animate-spin text-2xl" />
					<div v-else class="i-mdi-check-circle text-2xl" />
				</button>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import type { SongMetaData } from "~/types";

interface Props {
	song: SongMetaData;
	musicTitle?: string;
	channel?: string;
}

interface CurationOption {
	key: string;
	label: string;
	data: { artist: string; title: string };
}

const props = defineProps<Props>();
const emit = defineEmits<{
	cancel: [];
	success: [artist: string, title: string];
}>();

const saving = ref(false);

// Parse Last.fm ID to artist and title
const parseLastfmId = (
	id: string | undefined,
): { artist: string; title: string } => {
	if (!id) return { artist: "", title: "" };

	const parts = id.split("_");
	if (parts.length >= 2) {
		return {
			artist: decodeURIComponent(parts[0]).trim(),
			title: decodeURIComponent(parts[1]).trim(),
		};
	}

	return { artist: "", title: "" };
};

// Configuration for available curation options
const optionConfigs = [
	{
		key: "channel",
		label: "Channel Name",
		condition: () => !!props.channel,
		getData: () => ({
			artist: props.channel?.replace(" - Topic", "") || "",
			title: props.song.title,
		}),
	},
	{
		key: "youtube",
		label: "YouTube Title",
		condition: () => {
			return !!(props.song.artist || props.song.title);
		},
		getData: () => props.song,
	},
	{
		key: "youtube-metadata",
		label: "YouTube Metadata",
		condition: () => !!(props.song.youtube?.title || props.song.youtube?.channel),
		getData: () => ({
			artist: props.song.youtube?.channel || "",
			title: props.song.youtube?.title || "",
		}),
	},
	{
		key: "youtube2",
		label: "YouTube2 Title",
		condition: () => true,
		getData: () => ({ title: props.musicTitle, artist: props.channel }),
	},
	{
		key: "ai",
		label: "AI Parsed",
		condition: () => !!(props.song.ai?.artist || props.song.ai?.title),
		getData: () => ({
			artist: props.song.ai?.artist || "",
			title: props.song.ai?.title || "",
		}),
	},
	{
		key: "lastfm",
		label: "Last.fm Parsed",
		condition: () => {
			const parsed = parseLastfmId(props.song.lastfm?.id);
			return !!(parsed.artist || parsed.title);
		},
		getData: () => parseLastfmId(props.song.lastfm?.id),
	},
	{
		key: "musicbrainz",
		label: "MusicBrainz",
		condition: () => !!props.song.musicbrainz?.trackMbid,
		getData: () => ({
			artist: props.song.artist || "",
			title: props.song.title,
		}),
	},
];

// Build available options dynamically based on config
const availableOptions = computed<CurationOption[]>(() => {
	return optionConfigs
		.filter((config) => config.condition())
		.map((config) => ({
			key: config.key,
			label: config.label,
			data: reactive(config.getData()),
		}));
});

const swapFields = (data: { artist: string; title: string }) => {
	const temp = data.artist;
	data.artist = data.title;
	data.title = temp;
};

const submitCuration = async (
	optionKey: string,
	data: { artist: string; title: string },
) => {
	if (!data.artist || !data.title) {
		alert("Please fill in both artist and title");
		return;
	}

	if (saving.value) return;

	try {
		saving.value = true;

		await $fetch("/api/metadata/curate", {
			method: "POST",
			body: {
				youtubeId: props.song.youtubeId,
				artist: data.artist,
				title: data.title,
			},
		});

		emit("success", data.artist, data.title);
	} catch (error) {
		console.error("Error curating song:", error);
		alert("Failed to curate song metadata");
		saving.value = false;
	}
};
</script>
