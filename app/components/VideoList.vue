<template>
	<div class="rounded-lg sm:px-6">
		<div v-if="!videos.length" class="text-center py-8">
			<div class="i-mdi-video-outline text-4xl mb-2" />
			<p class="text-primary-3">No videos found.</p>
		</div>

		<div v-else class="overflow-x-auto">
			<table class="w-full border-collapse">
				<thead>
					<tr class="border-b border-primary-2">
						<th class="text-left p-3 font-medium text-primary-4">Video</th>
						<th class="text-left p-3 font-medium text-primary-4">Duration</th>
						<th class="text-left p-3 font-medium text-primary-4">Tags</th>
						<th class="text-left p-3 font-medium text-primary-4">Added</th>
					</tr>
				</thead>
				<tbody>
					<tr
						v-for="video in videos"
						:key="video.id"
						class="relative border-b border-primary-2/30 hover:bg-bg-gradient transition-colors cursor-pointer"
						:class="{
							'after:content-empty after:absolute after:inset-0 after:b-1 after:b-solid after:b-accent after:pointer-events-none after:rounded-2xl':
								highlightVideoId === video.id,
						}"
						@click="$emit('play', video)"
					>
						<!-- Video Info Column -->
						<td class="p-3">
							<div class="flex items-center gap-3">
								<div class="flex-shrink-0 relative">
									<img
										:src="`https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`"
										:alt="video.title"
										class="rounded-full size-16 object-cover bg-primary-1"
									/>
									<!-- Play Overlay -->
									<div
										class="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity rounded"
									>
										<div class="i-mdi-play-outline text-accent text-2xl" />
									</div>
									<!-- Currently Playing Indicator -->
									<div
										v-if="highlightVideoId === video.id"
										class="absolute -top-1 -right-1 bg-accent text-black px-1 py-0.5 rounded text-xs font-medium flex items-center gap-1"
									>
										<div class="i-mdi-volume-high w-2 h-2" />
									</div>
								</div>
								<div class="flex-1 min-w-0">
									<!-- Artist/Channel above title -->
									<div class="mb-1">
										<span
											v-if="video.artist"
											class="text-primary-2 text-xs font-medium"
										>
											{{ video.artist }}
										</span>
										<span v-else class="text-xs text-gray-5 opacity-80 italic">
											{{ video.channel }}
										</span>
									</div>

									<h4
										class="font-medium text-primary-3 line-clamp-2 text-sm mb-1"
									>
										{{ video.musicTitle || video.title }}
									</h4>
								</div>
							</div>
						</td>

						<!-- Duration Column -->
						<td class="p-3">
							<span
								class="text-sm text-primary-3 font-mono flex items-center gap-1"
							>
								<span class="i-mdi-clock-outline text-xs text-gray-6" />
								{{ video.duration }}
							</span>
						</td>

						<!-- Tags Column -->
						<td class="p-3">
							<div
								v-if="video.tags && video.tags.length > 0"
								class="relative flex gap-1 max-w-72 overflow-hidden"
							>
								<span
									v-for="tag in video.tags"
									:key="tag"
									class="text-xs b-1 b-solid b-accent-2 text-accent px-2 py-1 rounded-lg whitespace-nowrap flex-shrink-0"
								>
									{{ tag }}
								</span>
								<!-- Fade overlay -->
								<div
									class="absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-r from-transparent to-background group-hover:to-bg-gradient pointer-events-none"
								></div>
							</div>
						</td>

						<!-- Added Date Column -->
						<td class="p-3 min-w-30">
							<div class="flex items-center gap-2">
								<div
									class="w-3 h-3 rounded-full flex items-center justify-center text-white text-xs font-bold"
									:style="{
										backgroundColor: getUserColor(video.userId || ' '),
									}"
								>
									<span class="i-mdi-account text-xs" />
								</div>
							</div>
							<span
								v-if="video.createdAt"
								class="text-sm text-primary-3"
								:title="new Date(video.createdAt).toLocaleString()"
							>
								{{ formatDate(video.createdAt) }}
							</span>
							<span v-else class="text-sm text-primary-3 italic">Unknown</span>
						</td>
					</tr>
				</tbody>
			</table>
		</div>
	</div>
</template>

<script setup lang="ts">
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import type { Video } from "../types";

dayjs.extend(relativeTime);

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

// Format timestamp to readable date using dayjs
const formatDate = (timestamp: number): string => {
	return dayjs(timestamp).fromNow();
};
</script>
