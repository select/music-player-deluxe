import { promises as fs } from "fs";
import { join } from "path";

export default defineEventHandler(async (event) => {
	try {
		const playlistId = getRouterParam(event, "id");

		if (!playlistId) {
			throw createError({
				statusCode: 400,
				statusMessage: "Playlist ID is required",
			});
		}

		const playlistsDir = join(process.cwd(), "public", "playlists");
		const filePath = join(playlistsDir, `${playlistId}.json`);

		// Check if the playlist file exists
		try {
			await fs.access(filePath);
		} catch (error) {
			throw createError({
				statusCode: 404,
				statusMessage: "Playlist not found in cache",
			});
		}

		// Delete the playlist file
		await fs.unlink(filePath);

		// Update the index file
		await updateIndexFile(playlistId);

		return {
			success: true,
			message: "Playlist deleted successfully",
			playlistId: playlistId,
		};
	} catch (error: any) {
		console.error("Error deleting cached playlist:", error);

		// If it's already a createError, re-throw it
		if (error.statusCode) {
			throw error;
		}

		throw createError({
			statusCode: 500,
			statusMessage: "Failed to delete playlist from cache",
		});
	}
});

// Helper function to update the index file after deletion
async function updateIndexFile(deletedPlaylistId: string): Promise<void> {
	try {
		const indexFilePath = join(process.cwd(), "public", "index.json");

		// Read existing index
		let indexData: any = {
			success: true,
			data: [],
			count: 0,
			lastUpdated: new Date().toISOString(),
		};
		try {
			const indexContent = await fs.readFile(indexFilePath, "utf-8");
			indexData = JSON.parse(indexContent);
		} catch (error) {
			// File doesn't exist or is invalid, start with empty structure
		}

		// Remove the deleted playlist from index
		if (indexData.data) {
			indexData.data = indexData.data.filter(
				(item: any) => item.id !== deletedPlaylistId,
			);
			indexData.count = indexData.data.length;
			indexData.lastUpdated = new Date().toISOString();
		}

		// Write updated index
		await fs.writeFile(
			indexFilePath,
			JSON.stringify(indexData, null, 2),
			"utf-8",
		);
	} catch (error) {
		console.warn("Failed to update index file after deletion:", error);
	}
}
