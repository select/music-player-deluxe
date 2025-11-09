<template>
	<div class="relative">
		<!-- Label -->
		<label v-if="label" :for="id" class="block text-sm font-medium mb-2">
			{{ label }}
		</label>

		<!-- Main Input Container -->
		<div
			class="relative rounded-lg bg-primary-1 border border-primary-2 focus-within:ring-2 focus-within:ring-accent focus-within:border-accent transition-colors"
		>
			<!-- Selected Items Display -->
			<div
				v-if="selectedItems.length > 0"
				class="flex flex-wrap gap-1 p-2 border-b border-primary-2"
			>
				<span
					v-for="item in selectedItems"
					:key="item"
					class="inline-flex items-center gap-1 px-2 py-1 bg-primary-2 text-primary-4 text-xs rounded"
				>
					{{ item }}
					<button
						type="button"
						class="hover:text-accent transition-colors"
						@click="removeItem(item)"
					>
						<div class="i-mdi-close text-xs" />
					</button>
				</span>
			</div>

			<!-- Search Input -->
			<div class="relative">
				<input
					:id="id"
					ref="inputRef"
					v-model="searchQuery"
					type="text"
					:placeholder="placeholder"
					:disabled="disabled"
					class="w-full px-3 py-2 bg-transparent text-primary-4 placeholder-primary-3 focus:outline-none"
					autocomplete="off"
					@focus="showDropdown = true"
					@keydown="handleKeydown"
				/>

				<!-- Dropdown Toggle Button -->
				<button
					type="button"
					class="absolute right-2 top-1/2 transform -translate-y-1/2 text-primary-3 hover:text-accent transition-colors"
					@click="toggleDropdown"
				>
					<div
						:class="[
							'transition-transform duration-200',
							showDropdown ? 'i-mdi-chevron-up' : 'i-mdi-chevron-down',
						]"
					/>
				</button>
			</div>
		</div>

		<!-- Dropdown List -->
		<div
			v-if="showDropdown && (filteredOptions.length > 0 || searchQuery.trim())"
			class="absolute z-50 w-full mt-1 bg-primary-1 border border-primary-2 rounded-lg shadow-lg max-h-60 overflow-y-auto"
		>
			<!-- Filtered Options -->
			<button
				v-for="(option, index) in filteredOptions"
				:key="option"
				type="button"
				:class="[
					'w-full px-3 py-2 text-left hover:bg-bg-gradient transition-colors flex items-center justify-between',
					focusedIndex === index ? 'bg-bg-gradient' : '',
					selectedItems.includes(option) ? 'text-accent' : 'text-primary-4',
				]"
				@click="toggleSelection(option)"
				@mouseenter="focusedIndex = index"
			>
				<span>{{ option }}</span>
				<div
					v-if="selectedItems.includes(option)"
					class="i-mdi-check text-accent"
				/>
			</button>

			<!-- Add New Option (if search query doesn't match any existing option) -->
			<button
				v-if="
					searchQuery.trim() &&
					!options.includes(searchQuery.trim()) &&
					!selectedItems.includes(searchQuery.trim())
				"
				type="button"
				:class="[
					'w-full px-3 py-2 text-left hover:bg-bg-gradient transition-colors flex items-center gap-2 border-t border-primary-2',
					focusedIndex === filteredOptions.length ? 'bg-bg-gradient' : '',
				]"
				@click="addNewOption(searchQuery.trim())"
				@mouseenter="focusedIndex = filteredOptions.length"
			>
				<div class="i-mdi-plus text-accent" />
				<span class="text-primary-4">Add "{{ searchQuery.trim() }}"</span>
			</button>

			<!-- No Results -->
			<div
				v-if="filteredOptions.length === 0 && !searchQuery.trim()"
				class="px-3 py-2 text-primary-3 text-center"
			>
				No options available
			</div>
		</div>

		<!-- Help Text -->
		<p v-if="helpText" class="mt-1 text-xs text-primary-3">
			{{ helpText }}
		</p>

		<!-- Click Outside Handler -->
		<div
			v-if="showDropdown"
			class="fixed inset-0 z-40"
			@click="showDropdown = false"
		/>
	</div>
</template>

<script setup lang="ts">
import Fuse from "fuse.js";

interface Props {
	id?: string;
	label?: string;
	placeholder?: string;
	helpText?: string;
	options: string[];
	modelValue: string[];
	disabled?: boolean;
	maxSelections?: number;
}

interface Emits {
	"update:modelValue": [value: string[]];
}

const props = withDefaults(defineProps<Props>(), {
	id: () => `multiselect-${Math.random().toString(36).substr(2, 9)}`,
	label: "",
	placeholder: "Search and select options...",
	helpText: "",
	disabled: false,
	maxSelections: undefined,
});

const emit = defineEmits<Emits>();

// Reactive state
const searchQuery = ref<string>("");
const showDropdown = ref<boolean>(false);
const focusedIndex = ref<number>(-1);
const inputRef = ref<HTMLInputElement>();

// Computed properties
const selectedItems = computed<string[]>({
	get: () => props.modelValue,
	set: (value: string[]) => emit("update:modelValue", value),
});

// Fuse.js for fuzzy search
const fuse = computed(
	() =>
		new Fuse(props.options, {
			threshold: 0.3,
			includeScore: true,
			minMatchCharLength: 1,
		}),
);

// Filtered options based on search query
const filteredOptions = computed<string[]>(() => {
	if (!searchQuery.value.trim()) {
		return props.options.slice(0, 50); // Limit initial display for performance
	}

	const results = fuse.value.search(searchQuery.value);
	return results.map((result) => result.item).slice(0, 50); // Limit results
});

// Methods
const toggleSelection = (item: string): void => {
	const currentSelection = [...selectedItems.value];
	const index = currentSelection.indexOf(item);

	if (index > -1) {
		// Remove item
		currentSelection.splice(index, 1);
	} else {
		// Add item (if not at max limit)
		if (!props.maxSelections || currentSelection.length < props.maxSelections) {
			currentSelection.push(item);
		}
	}

	selectedItems.value = currentSelection;
	// Don't clear search query on selection
	focusedIndex.value = -1;
};

const removeItem = (item: string): void => {
	const currentSelection = [...selectedItems.value];
	const index = currentSelection.indexOf(item);

	if (index > -1) {
		currentSelection.splice(index, 1);
		selectedItems.value = currentSelection;
	}
};

const addNewOption = (newOption: string): void => {
	if (newOption && !selectedItems.value.includes(newOption)) {
		if (
			!props.maxSelections ||
			selectedItems.value.length < props.maxSelections
		) {
			selectedItems.value = [...selectedItems.value, newOption];
		}
	}
	// Don't clear search query on new option add
	showDropdown.value = false;
	focusedIndex.value = -1;
};

const toggleDropdown = (): void => {
	if (props.disabled) return;

	showDropdown.value = !showDropdown.value;
	if (showDropdown.value) {
		nextTick(() => {
			inputRef.value?.focus();
		});
	}
};

// Keyboard navigation
const handleKeydown = (event: KeyboardEvent): void => {
	if (props.disabled) return;

	const hasNewOption =
		searchQuery.value.trim() &&
		!props.options.includes(searchQuery.value.trim()) &&
		!selectedItems.value.includes(searchQuery.value.trim());
	const totalOptions = filteredOptions.value.length + (hasNewOption ? 1 : 0);

	switch (event.key) {
		case "ArrowDown":
			event.preventDefault();
			showDropdown.value = true;
			if (focusedIndex.value < totalOptions - 1) {
				focusedIndex.value++;
			} else {
				focusedIndex.value = 0; // Wrap to top
			}
			break;

		case "ArrowUp":
			event.preventDefault();
			showDropdown.value = true;
			if (focusedIndex.value > 0) {
				focusedIndex.value--;
			} else {
				focusedIndex.value = totalOptions - 1; // Wrap to bottom
			}
			break;

		case "Enter":
			event.preventDefault();
			if (showDropdown.value && focusedIndex.value >= 0 && totalOptions > 0) {
				if (focusedIndex.value < filteredOptions.value.length) {
					toggleSelection(filteredOptions.value[focusedIndex.value]!);
				} else if (hasNewOption) {
					addNewOption(searchQuery.value.trim());
				}
			} else {
				showDropdown.value = true;
				if (totalOptions > 0) {
					focusedIndex.value = 0;
				}
			}
			break;

		case "Escape":
			showDropdown.value = false;
			focusedIndex.value = -1;
			inputRef.value?.blur();
			break;

		case "Backspace":
			if (!searchQuery.value && selectedItems.value.length > 0) {
				event.preventDefault();
				const lastItem = selectedItems.value[selectedItems.value.length - 1];
				if (lastItem) {
					removeItem(lastItem);
				}
			}
			break;
	}
};

// Reset focused index when search changes
watch(searchQuery, () => {
	focusedIndex.value = -1;
});

// Auto-focus when dropdown opens
watch(showDropdown, (isOpen) => {
	if (isOpen) {
		nextTick(() => {
			inputRef.value?.focus();
		});
	}
});
</script>
