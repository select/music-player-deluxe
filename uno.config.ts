import { defineConfig, presetIcons } from "unocss";
import presetWind4 from "@unocss/preset-wind4";

export default defineConfig({
	presets: [
		presetWind4({
			preflights: {
				reset: true,
				theme: "on-demand",
				property: true,
			},
		}),
		presetIcons({
			collections: {
				mdi: () => import("@iconify/json/json/mdi.json").then((i) => i.default),
			},
			autoInstall: true,
		}),
	],
	theme: {
		colors: {
			background: "#1b1919",
			"bg-gradient": "rgba(49,47,47,.8)",
			"primary-1": "#000",
			"primary-2": "#576b87",
			"primary-3": "#a4b3c9",
			"primary-4": "#fff",
			watchPageBtn: "#a4b3c9",
			accent: "#ffd700",
			"accent-1": "rgba(255, 215, 0, 0.6)",
			"accent-2": "rgba(255, 215, 0, 0.4)",
			white: "#fff",
			dark: "#222",
			success: "#8dc572",
			error: "#be6464",
			warning: "#f0ad4e",
			info: "#337ab7",
		},
		fontFamily: {
			mono: ['"Courier New"', "monospace"],
			sans: [
				"system-ui",
				"-apple-system",
				"BlinkMacSystemFont",
				'"Segoe UI"',
				"Roboto",
				"sans-serif",
			],
		},
	},
	preflights: [
		{
			getCSS: ({ theme }: { theme: any }) => `
				/* Set default font family for body and html */
				html,
				body {
					font-family: ${theme.fontFamily.sans.join(", ")};
				}

				/* Code elements should use monospace font */
				code,
				pre {
					font-family: ${theme.fontFamily.mono[0]}, monospace;
				}

				/* Global heading styles */
				h1,
				h2,
				h3,
				h4,
				h5,
				h6 {
					line-height: 1.25;
					color: ${theme.colors["primary-3"]};
				}

				/* Paragraph styles */
				p {
					line-height: 1.625;
				}

				/* Global link styles */
				a {
					color: ${theme.colors["primary-3"]};
					text-decoration: none;
				}

				a:hover {
					color: ${theme.colors["primary-4"]};
				}

				/* Remove default ul indentation so bullets align left */
				ul {
					padding-left: 1rem;
					margin-left: 0;
				}

				/* Custom scrollbar styles */
				::-webkit-scrollbar {
					width: 8px;
					height: 8px;
				}

				::-webkit-scrollbar-track {
					background: transparent;
					border-radius: 4px;
				}

				::-webkit-scrollbar-thumb {
					background: ${theme.colors["primary-2"]};
					border-radius: 4px;
					border: 1px solid ${theme.colors["primary-1"]};
				}

				::-webkit-scrollbar-thumb:hover {
					background: ${theme.colors["primary-3"]};
				}

				::-webkit-scrollbar-corner {
					background: transparent;
				}

				/* Firefox scrollbar styles */
				* {
					scrollbar-width: thin;
					scrollbar-color: ${theme.colors["primary-2"]} transparent;
				}
			`,
		},
	],
	safelist: [
		// Ensure classes used in Nuxt config are always included
		"text-primary-2",
		"bg-background",
		"leading-relaxed",
	],
});
