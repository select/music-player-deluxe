<template>
	<div class="w-full overflow-hidden">
		<label v-if="label" :for="id" class="block text-sm font-medium">
			{{ label }}
		</label>
		<input
			:id="id"
			:type="type"
			:placeholder="placeholder"
			:disabled="disabled"
			:required="required"
			class="w-full rounded-lg bg-primary-1 text-accent border-0 transition-colors focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed placeholder:text-accent-1"
			:class="{
				// Size classes
				'px-3 py-1 text-sm h-8': size === 'small',
				'px-4 py-2 h-10': size === 'medium',
				'px-6 py-3 text-lg h-12': size === 'large',
			}"
			:value="modelValue"
			@input="
				$emit('update:modelValue', ($event.target as HTMLInputElement).value)
			"
		/>
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

const props = withDefaults(defineProps<Props>(), {
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
