// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
	compatibilityDate: "2025-07-15",
	devtools: { enabled: true },
	modules: [
		"@unocss/nuxt",
		"@nuxt/eslint",
		"@nuxt/test-utils",
		[
			"@pinia/nuxt",
			{ autoImports: ["defineStore", "acceptHMRUpdate", "storeToRefs"] },
		],
	],
	imports: {
		dirs: ["stores"],
	},
	app: {
		head: {
			htmlAttrs: {
				class: "font-sans",
			},
			bodyAttrs: {
				class: "font-sans text-primary-2 bg-background leading-relaxed",
			},
		},
	},
	nitro: {
		prerender: {
			ignore: ["/admin"],
		},
	},
});
