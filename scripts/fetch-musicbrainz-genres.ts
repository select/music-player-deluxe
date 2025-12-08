#!/usr/bin/env ts-node

/**
 * Fetches the MusicBrainz genres list and stores it as a local JSON file.
 * Open license (CC0), safe to use.
 */

import * as fs from "fs";
import * as path from "path";

const OUTPUT = path.join(process.cwd(), "data/musicbrainz-genres.json");
const URL = "https://musicbrainz.org/genres";

async function fetchGenres() {
    console.log("Fetching MusicBrainz genres...");

    const res = await fetch(URL, {
        headers: { "User-Agent": "music-player-deluxe/1.0 (genre-fetcher)" }
    });

    if (!res.ok) {
        console.error("Failed to fetch:", res.status, res.statusText);
        process.exit(1);
    }

    const html = await res.text();

    // Very simple HTML scraping: looks for <a href="/genre/...">
    const genreRegex = /<a\s+href="\/genre\/[^"]+">([\s\S]*?)<\/a>/g;

    const genres = new Set<string>();
    let match;

    while ((match = genreRegex.exec(html)) !== null) {
        const inner = match[1]; // e.g. "<bdi>2 tone</bdi>"
        const cleaned = inner.replace(/<[^>]+>/g, "").trim(); // → "2 tone"
        if (cleaned) genres.add(cleaned.toLowerCase());
    }

    console.log("Gefundene Genres:", genres);

    const sorted = Array.from(genres).sort();

    const json = {
        source: "musicbrainz.org",
        license: "CC0",
        fetched_at: new Date().toISOString(),
        count: sorted.length,
        genres: sorted
    };

    fs.writeFileSync(OUTPUT, JSON.stringify(json, null, 2), "utf8");

    console.log(`✔ Saved ${sorted.length} genres to ${OUTPUT}`);
}

fetchGenres().catch((e) => {
    console.error("Error:", e);
    process.exit(1);
});
