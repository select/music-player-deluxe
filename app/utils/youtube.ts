import { Innertube } from "youtubei.js";
import type { Video } from "../types/index.js";

/**
 * Shared YouTube fetching helpers built on youtubei.js (InnerTube).
 *
 * YouTube migrated playlists to the `lockupViewModel` format, which the older
 * `youtubei` library can no longer parse (it returns 0 items). youtubei.js
 * collects each playlist entry as a `LockupView` node in the response "memo"
 * rather than the legacy `playlist.items` array, so we read them out of the
 * memo directly and follow continuation tokens manually.
 */

export interface NormalizedPlaylist {
	id: string;
	title: string;
	description: string;
	videoCount: number;
	videos: Video[];
}

/** Create a fresh InnerTube client (no player needed for metadata-only use). */
export async function createYouTubeClient(): Promise<Innertube> {
	return Innertube.create({ retrieve_player: false });
}

/** Extract the duration text (e.g. "6:31") from a LockupView's thumbnail overlays. */
function extractDuration(lockup: any): string {
	const overlays = lockup?.content_image?.overlays ?? [];
	for (const overlay of overlays) {
		for (const badge of overlay?.badges ?? []) {
			if (typeof badge?.text === "string" && /^\d+(:\d{1,2})+$/.test(badge.text)) {
				return badge.text;
			}
		}
	}
	return "Unknown Duration";
}

/**
 * Extract the channel/artist name from a LockupView's metadata rows. Prefer a
 * part that links to a channel; fall back to the first non-empty text run.
 */
function extractChannel(lockup: any): string {
	const rows = lockup?.metadata?.metadata?.metadata_rows ?? [];
	let fallback: string | undefined;
	for (const row of rows) {
		for (const part of row?.metadata_parts ?? []) {
			const text: string | undefined = part?.text?.text;
			if (!text) continue;
			if (fallback === undefined) fallback = text;
			const browseId = part?.text?.runs?.[0]?.endpoint?.payload?.browseId;
			if (typeof browseId === "string" && browseId.startsWith("UC")) {
				return text;
			}
		}
	}
	return fallback || "Unknown Channel";
}

/**
 * Convert a LockupView node into our Video shape. Returns null for non-video
 * entries (e.g. deleted/private placeholders without a content id).
 */
function lockupToVideo(lockup: any): Video | null {
	const id: string | undefined = lockup?.content_id;
	if (!id || lockup?.content_type !== "VIDEO") return null;
	return {
		id,
		title: lockup?.metadata?.title?.text || "Unknown Title",
		channel: extractChannel(lockup),
		duration: extractDuration(lockup),
	};
}

/** Pull a continuation token out of a ContinuationItemView node. */
function getContinuationToken(node: any): string | null {
	const token = node?.endpoint?.payload?.token;
	return typeof token === "string" && token.length > 20 ? token : null;
}

/**
 * Fetch a playlist's metadata and every video entry, following continuation
 * tokens. `onProgress` is called with the running video count after each page.
 */
export async function fetchPlaylistVideos(
	yt: Innertube,
	playlistId: string,
	onProgress?: (count: number) => void,
): Promise<NormalizedPlaylist> {
	const pl: any = await yt.getPlaylist(playlistId);
	if (!pl) {
		throw new Error("Playlist not found");
	}

	const videoCount =
		parseInt(String(pl.info?.total_items ?? "").replace(/[^\d]/g, ""), 10) || 0;

	const lockups: any[] = [...(pl.page?.contents_memo?.get("LockupView") ?? [])];
	let token = getContinuationToken(
		pl.page?.contents_memo?.get("ContinuationItemView")?.[0],
	);
	onProgress?.(lockups.length);

	const MAX_PAGES = 200; // safety guard (~20k videos at 100/page)
	let pages = 0;
	while (token && pages < MAX_PAGES) {
		pages++;
		const resp: any = await yt.actions.execute("/browse", {
			continuation: token,
			parse: true,
		});
		const memo = resp?.on_response_received_actions_memo;
		const pageLockups: any[] = memo?.get("LockupView") ?? [];
		if (pageLockups.length === 0) break;
		lockups.push(...pageLockups);
		onProgress?.(lockups.length);
		token = getContinuationToken(memo?.get("ContinuationItemView")?.[0]);
	}

	const videos = lockups
		.map(lockupToVideo)
		.filter((v): v is Video => v !== null);

	return {
		id: playlistId,
		title: pl.info?.title || "",
		description: pl.info?.description || "",
		videoCount,
		videos,
	};
}

/** Fetch a single video's title and channel name. Returns null on failure. */
export async function fetchVideoMetadata(
	yt: Innertube,
	videoId: string,
): Promise<{ title: string; channel: string } | null> {
	try {
		const info: any = await yt.getBasicInfo(videoId);
		const bi = info?.basic_info;
		if (!bi) return null;
		return {
			title: bi.title || "Unknown Title",
			channel: bi.channel?.name || bi.author || "Unknown Channel",
		};
	} catch (error) {
		console.error(
			`Error fetching YouTube metadata for ${videoId}:`,
			(error as Error).message,
		);
		return null;
	}
}
