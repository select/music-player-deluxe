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

interface UpdateTagBlacklistRequest {
	blacklistedTags: string[];
}

export default defineEventHandler(
	async (
		event,
	): Promise<{
		success: boolean;
		message: string;
		data: { blacklistedTags: string[] };
	}> => {
		if (getMethod(event) !== "POST") {
			throw createError({
				statusCode: 405,
				statusMessage: "Method not allowed",
			});
		}

		try {
			const body: UpdateTagBlacklistRequest = await readBody(event);

			if (!Array.isArray(body.blacklistedTags)) {
				throw createError({
					statusCode: 400,
					statusMessage: "blacklistedTags must be an array",
				});
			}

			// Validate that all tags are strings
			const validTags = body.blacklistedTags
				.filter((tag) => typeof tag === "string" && tag.trim().length > 0)
				.map((tag) => tag.toLowerCase().trim());

			// Remove duplicates
			const uniqueTags = [...new Set(validTags)];

			const blacklistData: TagBlacklistData = {
				blacklistedTags: uniqueTags.sort(),
				lastUpdated: new Date().toISOString(),
			};

			// Ensure the directory exists
			const dir = path.dirname(BLACKLIST_FILE);
			if (!fs.existsSync(dir)) {
				fs.mkdirSync(dir, { recursive: true });
			}

			// Save the blacklist
			fs.writeFileSync(BLACKLIST_FILE, JSON.stringify(blacklistData, null, 2));

			return {
				success: true,
				message: `Tag blacklist updated with ${uniqueTags.length} tags`,
				data: {
					blacklistedTags: uniqueTags,
				},
			};
		} catch (error: any) {
			console.error("Error updating tag blacklist:", error);

			if (error.statusCode) {
				throw error;
			}

			throw createError({
				statusCode: 500,
				statusMessage: "Failed to update tag blacklist",
			});
		}
	},
);
