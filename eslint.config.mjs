// @ts-check
import withNuxt from "./.nuxt/eslint.config.mjs";

export default withNuxt(
	{
		rules: {
			// Vue specific rules for project standards
			"vue/define-props-declaration": ["error", "type-based"],
			"vue/define-emits-declaration": ["error", "type-based"],
			"vue/block-lang": [
				"error",
				{
					script: { lang: "ts" },
				},
			],
			"vue/component-api-style": ["error", ["script-setup"]],
			"vue/define-macros-order": [
				"error",
				{
					order: ["defineOptions", "defineProps", "defineEmits", "defineSlots"],
				},
			],

			// Project-specific overrides
			"vue/multi-word-component-names": "off",
			"vue/require-default-prop": "off",

			// Allow unused variables that start with underscore
			"no-unused-vars": [
				"error",
				{
					argsIgnorePattern: "^_",
					varsIgnorePattern: "^_",
					caughtErrorsIgnorePattern: "^_",
				},
			],
		},
	},
	{
		// Additional config for TypeScript in Vue files
		files: ["**/*.vue"],
		languageOptions: {
			parserOptions: {
				parser: "@typescript-eslint/parser",
				ecmaVersion: "latest",
				sourceType: "module",
				extraFileExtensions: [".vue"],
			},
		},
	},
);
