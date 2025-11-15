<template>
	<NuxtLink
		v-if="to"
		:to="to"
		class="inline-flex items-center gap-2 rounded-full transition-colors font-medium border-solid cursor-pointer no-underline"
		:class="[
			// Size classes
			{
				'px-3 py-1 text-sm': size === 'small',
				'px-4 py-1': size === 'medium',
				'px-6 py-3 text-lg': size === 'large',
			},
			// Variant classes
			{
				'bg-transparent b-1 border-accent text-accent hover:bg-accent hover:text-primary-1':
					variant === 'primary',
				'bg-transparent b-1 border-error text-error hover:bg-error hover:text-primary-1':
					variant === 'danger',
				'bg-primary-1 b-1 border-primary-2 text-primary-3 hover:bg-primary-2 hover:text-primary-4':
					variant === 'secondary',
				'bg-transparent text-primary-3 hover:bg-primary-2 hover:text-primary-4':
					variant === 'ghost',
			},
		]"
		@click="$emit('click', $event)"
	>
		<div v-if="loading" class="i-mdi-loading animate-spin"/>
		<div v-else-if="icon" :class="icon"/>
		<slot v-if="!loading || showTextWhileLoading" />
	</NuxtLink>
	<button
		v-else
		:type="type"
		:disabled="disabled || loading"
		class="flex items-center gap-2 rounded-full transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-primary-2 disabled:hover:text-primary-4 border-solid cursor-pointer text-nowrap"
		:class="{
			// Size classes
			'px-3 py-1 text-sm': size === 'small',
			'px-4 py-1': size === 'medium',
			'px-6 py-3 text-lg': size === 'large',
			// Variant classes
			'bg-transparent b-1 border-accent text-accent hover:bg-accent hover:text-primary-1':
				variant === 'primary',
			'bg-transparent b-1 border-error text-error hover:bg-error hover:text-primary-1':
				variant === 'danger',
			'bg-primary-1 b-1 border-primary-2 text-primary-3 hover:bg-primary-2 hover:text-primary-4':
				variant === 'secondary',
			'bg-transparent text-primary-3 hover:bg-primary-2 hover:text-primary-4':
				variant === 'ghost',
		}"
		@click="$emit('click', $event)"
	>
		<div v-if="loading" class="i-mdi-loading animate-spin"/>
		<div v-else-if="icon" :class="icon"/>
		<slot v-if="!loading || showTextWhileLoading" />
	</button>
</template>

<script setup lang="ts">
withDefaults(
	defineProps<{
		variant?: ButtonVariant;
		size?: ButtonSize;
		type?: ButtonType;
		disabled?: boolean;
		loading?: boolean;
		icon?: string | null;
		showTextWhileLoading?: boolean;
		to?: string;
	}>(),
	{
		variant: "primary",
		size: "medium",
		type: "button",
		disabled: false,
		loading: false,
		icon: null,
		showTextWhileLoading: false,
		to: undefined,
	},
);

defineEmits<{
	click: [event: MouseEvent];
}>();

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
type ButtonSize = "small" | "medium" | "large";
type ButtonType = "button" | "submit" | "reset";
</script>
