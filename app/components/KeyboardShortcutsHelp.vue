<template>
	<div
		v-if="showHelp"
		class="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50"
		@click="$emit('close')"
	>
		<div
			class="bg-primary-1 rounded-lg p-6 max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto"
			@click.stop
		>
			<div class="flex justify-between items-center mb-4">
				<h3 class="text-lg font-semibold text-primary-4">Keyboard Shortcuts</h3>
				<AppBtn
					icon="i-mdi-close"
					variant="ghost"
					size="small"
					@click="$emit('close')"
				/>
			</div>

			<div class="space-y-3">
				<div class="flex justify-between items-center">
					<span class="text-primary-3">Play/Pause</span>
					<kbd class="px-2 py-1 bg-primary-2 rounded text-sm text-primary-4">{{
						formattedShortcuts.playPause
					}}</kbd>
				</div>

				<div class="flex justify-between items-center">
					<span class="text-primary-3">Next Track</span>
					<kbd class="px-2 py-1 bg-primary-2 rounded text-sm text-primary-4">{{
						formattedShortcuts.nextTrack
					}}</kbd>
				</div>

				<div class="flex justify-between items-center">
					<span class="text-primary-3">Previous Track</span>
					<kbd class="px-2 py-1 bg-primary-2 rounded text-sm text-primary-4">{{
						formattedShortcuts.previousTrack
					}}</kbd>
				</div>

				<div class="flex justify-between items-center">
					<span class="text-primary-3">Volume Up</span>
					<kbd class="px-2 py-1 bg-primary-2 rounded text-sm text-primary-4">{{
						formattedShortcuts.volumeUp
					}}</kbd>
				</div>

				<div class="flex justify-between items-center">
					<span class="text-primary-3">Volume Down</span>
					<kbd class="px-2 py-1 bg-primary-2 rounded text-sm text-primary-4">{{
						formattedShortcuts.volumeDown
					}}</kbd>
				</div>

				<div class="flex justify-between items-center">
					<span class="text-primary-3">Mute</span>
					<kbd class="px-2 py-1 bg-primary-2 rounded text-sm text-primary-4">{{
						formattedShortcuts.mute
					}}</kbd>
				</div>

				<div class="flex justify-between items-center">
					<span class="text-primary-3">Seek Forward</span>
					<kbd class="px-2 py-1 bg-primary-2 rounded text-sm text-primary-4">{{
						formattedShortcuts.seekForward
					}}</kbd>
				</div>

				<div class="flex justify-between items-center">
					<span class="text-primary-3">Seek Backward</span>
					<kbd class="px-2 py-1 bg-primary-2 rounded text-sm text-primary-4">{{
						formattedShortcuts.seekBackward
					}}</kbd>
				</div>
			</div>

			<div class="mt-6 pt-4 border-t border-primary-2">
				<p class="text-sm text-primary-3">
					Current scheme:
					<span class="text-primary-4 font-medium">
						{{
							settings.keyboardShortcutScheme === "simple"
								? "Default"
								: settings.keyboardShortcutScheme === "winamp"
									? "Winamp Style"
									: "YouTube Style"
						}}
					</span>
				</p>
				<p class="text-xs text-primary-3 mt-2">
					Change keyboard shortcuts in the Filters panel
				</p>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
interface Props {
	showHelp: boolean;
}

interface Emits {
	close: [];
}

const props = withDefaults(defineProps<Props>(), {
	showHelp: false,
});

defineEmits<Emits>();

// Stores and composables
const { currentKeyboardShortcuts, settings } = storeToRefs(
	useUserSettingsStore(),
);

// Get formatted shortcuts for display
const formattedShortcuts = computed(() => ({
	playPause: formatKeyForDisplay(currentKeyboardShortcuts.value.playPause),
	nextTrack: formatKeyForDisplay(currentKeyboardShortcuts.value.nextTrack),
	previousTrack: formatKeyForDisplay(
		currentKeyboardShortcuts.value.previousTrack,
	),
	volumeUp: formatKeyForDisplay(currentKeyboardShortcuts.value.volumeUp),
	volumeDown: formatKeyForDisplay(currentKeyboardShortcuts.value.volumeDown),
	mute: formatKeyForDisplay(currentKeyboardShortcuts.value.mute),
	seekForward: formatKeyForDisplay(currentKeyboardShortcuts.value.seekForward),
	seekBackward: formatKeyForDisplay(
		currentKeyboardShortcuts.value.seekBackward,
	),
}));

// Format key for display
const formatKeyForDisplay = (key: string): string => {
	const keyMap: Record<string, string> = {
		" ": "Space",
		ArrowLeft: "←",
		ArrowRight: "→",
		ArrowUp: "↑",
		ArrowDown: "↓",
		x: "X",
		z: "Z",
		b: "B",
		c: "C",
		v: "V",
		m: "M",
		l: "L",
		j: "J",
		k: "K",
		n: "N",
		p: "P",
	};

	return keyMap[key] || key.toUpperCase();
};

// Get formatted shortcuts for display
const getFormattedShortcuts = () => {};
</script>
