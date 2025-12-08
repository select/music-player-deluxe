<template>
	<div class="w-full overflow-hidden">
		<label v-if="label" :for="id" class="pl-3 block text-sm font-medium">
			{{ label }}
		</label>
		<div class="relative">
			<input
				:id="id"
				:type="type"
				:placeholder="placeholder"
				:disabled="disabled"
				:required="required"
				class="w-full rounded-lg bg-primary-1 text-accent border-0 transition-colors focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed placeholder:text-accent-1"
				:class="{
					// Size classes
					'px-3 py-1 text-sm h-8 pr-8': size === 'small',
					'px-4 py-2 h-10 pr-10': size === 'medium',
					'px-6 py-3 text-lg h-12 pr-12': size === 'large',
				}"
				:value="modelValue"
				data-input
				@input="
					$emit('update:modelValue', ($event.target as HTMLInputElement).value)
				"
				@keydown.stop
			/>
			<button
				v-if="modelValue"
				type="button"
				class="absolute inset-y-0 right-0 flex items-center justify-center text-primary-3 hover:text-accent transition-colors"
				:class="{
					'w-8': size === 'small',
					'w-10': size === 'medium',
					'w-12': size === 'large',
				}"
				@click="$emit('update:modelValue', '')"
			>
				<div
					class="i-mdi-close"
					:class="{
						'w-3 h-3': size === 'small',
						'w-4 h-4': size === 'medium',
						'w-5 h-5': size === 'large',
					}"
				/>
			</button>
		</div>
		<p v-if="helpText" class="text-xs">
			{{ helpText }}
		</p>
	</div>
</template>

<script setup lang="ts">
type InputSize = "small" | "medium" | "large";

interface Props {
	id?: string;
	type?: string;
	label?: string;
	placeholder?: string;
	helpText?: string;
	modelValue?: string;
	disabled?: boolean;
	required?: boolean;
	size?: InputSize;
}

withDefaults(defineProps<Props>(), {
	id: undefined,
	type: "text",
	label: undefined,
	placeholder: "",
	helpText: undefined,
	modelValue: "",
	disabled: false,
	required: false,
	size: "medium",
});

defineEmits<{
	"update:modelValue": [value: string];
}>();
</script>
