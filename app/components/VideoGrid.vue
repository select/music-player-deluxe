<template>
	<div
		class="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(240px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4 sm:gap-6 px-6"
	>
		<div
			v-for="(video, index) in videos"
			:key="video.id"
			class="relative group shadow-black hover:shadow-md hover:bg-zinc-900 flex flex-col gap-3 rounded-2xl hover:rounded-b-0 pa-2 transition-shadow duration-200"
			:class="{
				'outline-accent outline-2 outline-solid outline-bottom-0':
					highlightVideoId === video.id,
			}"
		>
			<!-- Video Thumbnail -->
			<div
				class="rounded-2xl overflow-hidden w-full aspect-video relative cursor-pointer"
				@click="$emit('play', video)"
			>
				<!-- Play Overlay -->
				<div
					class="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
				>
					<div class="i-mdi-play-outline text-accent text-8xl" />
				</div>
				<!-- Currently Playing Indicator -->
				<div
					v-if="highlightVideoId === video.id"
					class="absolute top-2 right-2 bg-accent text-black px-2 py-1 rounded text-xs font-medium flex items-center gap-1"
				>
					<div class="i-mdi-volume-high w-3 h-3" />
					Playing
				</div>
				<img
					v-if="video.thumbnail"
					:src="video.thumbnail"
					:alt="video.title"
					class="w-full h-full object-cover"
					loading="lazy"
				/>
				<div
					v-else
					class="w-full h-full flex items-center justify-center bg-gray-700"
				>
					<div class="i-mdi-video text-gray-500 text-3xl" />
				</div>
			</div>

			<!-- Video Info -->
			<div class="flex flex-col gap-1">
				<!-- Artist -->
				<div v-if="video.artist" class="text-gray-5 text-sm font-medium">
					{{ video.artist }}
				</div>

				<!-- Title -->
				<div class="leading-5 text-primary-3 line-clamp-2">
					{{ video.musicTitle || video.title }}
				</div>

				<!-- First Tag -->
				<div v-if="video.tags && video.tags.length > 0" class="text-xs">
					{{ video.tags[0] }}
				</div>
			</div>

			<!-- Hover Overlay -->
			<div
				class="hidden group-hover:flex absolute bg-zinc-900 w-full top-full left-0 flex-col z-10 shadow-black shadow-md rounded-b-2xl p-3"
				:class="{
					'outline-2 outline-solid outline-accent ':
						highlightVideoId === video.id,
				}"
			>
				<!-- Channel and Duration -->
				<div class="flex items-center justify-between gap-3 mb-2">
					<p class="text-gray-400 text-xs sm:text-sm">
						{{ video.channel }}
					</p>
					<p
						class="text-gray-500 text-xs sm:text-sm flex items-center justify-center gap-1"
					>
						<span class="i-mdi-clock-outline text-xs" />
						{{ video.duration }}
					</p>
				</div>

				<!-- Tags -->
				<div v-if="video.tags && video.tags.length > 0" class="pt-2">
					<div class="flex flex-wrap gap-1">
						<span
							v-for="tag in video.tags"
							:key="tag"
							class="text-xs b-1 b-solid b-accent-2 text-accent px-2 py-1 rounded-lg"
						>
							{{ tag }}
						</span>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import type { Video } from "../types";

const props = withDefaults(
	defineProps<{
		videos?: Video[];
		highlightVideoId?: string;
	}>(),
	{
		videos: () => [],
		highlightVideoId: "",
	},
);

defineEmits<{
	play: [video: Video];
}>();
</script>
