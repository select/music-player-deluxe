import fs from "fs";
import path from "path";

const BLACKLIST_FILE = path.join(
	process.cwd(),
	"server/assets/tag-blacklist.json",
);

interface TagBlacklistData {
	blacklistedTags: string[];
	lastUpdated: string;
}

export default defineEventHandler(
	async (
		event,
	): Promise<{
		success: boolean;
		data: { availableTags: string[]; blacklistedTags: string[] };
	}> => {
		try {
			// Get all unique tags from songs
			const songsDir = path.join(process.cwd(), "server/assets/songs");
			const availableTags = new Set<string>();

			if (fs.existsSync(songsDir)) {
				const files = fs
					.readdirSync(songsDir)
					.filter((file) => file.endsWith(".json"));

				for (const file of files) {
					try {
						const filePath = path.join(songsDir, file);
						const songData = JSON.parse(fs.readFileSync(filePath, "utf8"));

						// Collect tags from different sources
						const allTags: string[] = [];

						if (songData.musicbrainz?.tags) {
							allTags.push(...songData.musicbrainz.tags);
						}

						if (songData.musicbrainz?.artistTags) {
							allTags.push(...songData.musicbrainz.artistTags);
						}

						if (songData.lastfm?.tags) {
							allTags.push(...songData.lastfm.tags);
						}

						// Add all tags to our set
						allTags.forEach((tag) => {
							if (tag && typeof tag === "string") {
								availableTags.add(tag.toLowerCase().trim());
							}
						});
					} catch (error) {
						console.warn(`Error reading song file ${file}:`, error);
					}
				}
			}

			// Load current blacklist
			let blacklistedTags: string[] = [];
			if (fs.existsSync(BLACKLIST_FILE)) {
				try {
					const blacklistData: TagBlacklistData = JSON.parse(
						fs.readFileSync(BLACKLIST_FILE, "utf8"),
					);
					blacklistedTags = blacklistData.blacklistedTags || [];
				} catch (error) {
					console.warn("Error reading blacklist file:", error);
				}
			}

			return {
				success: true,
				data: {
					availableTags: Array.from(availableTags).sort(),
					blacklistedTags: blacklistedTags.sort(),
				},
			};
		} catch (error) {
			console.error("Error fetching tags:", error);
			throw createError({
				statusCode: 500,
				statusMessage: "Failed to fetch tags",
			});
		}
	},
);
