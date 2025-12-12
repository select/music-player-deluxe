#!/usr/bin/env node
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================
// CONFIG
// ============================================================

const SONGS_DIR = path.join(__dirname, "../../server/assets/songs");
const OUTPUT_PATH = path.join(__dirname, "../../data/tag-map-pipeline/tag-source-raw.jsonl");
const BLACKLIST_OUTPUT = path.join(__dirname, "../../data/tag-map-pipeline/tag-source-blacklisted.jsonl");

const BLACKLIST_PATH = path.join(__dirname, "../../server/assets/tag-blacklist.json");

const TAG_SOURCES: Array<[string, string, string]> = [
  ["lastfm", "tags", "lastfm:tags"],
  ["musicbrainz", "artistTags", "musicbrainz:artistTags"],
  ["musicbrainz", "artistGenres", "musicbrainz:artistGenres"],
  ["musicbrainz", "genres", "musicbrainz:genres"],
];

// ============================================================
// TYPES
// ============================================================

export interface RawTagRecord {
  songId: string;
  tag: string;       // raw tag
  normalized: string; // normalized
  source: string;
}

// ============================================================
// HELPERS
// ============================================================

function normalizeTagString(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
}

function ensureFileDir(filePath: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function appendJsonl(filePath: string, obj: unknown) {
  fs.appendFileSync(filePath, JSON.stringify(obj) + "\n", "utf8");
}

function loadBlacklist(): Set<string> {
  if (!fs.existsSync(BLACKLIST_PATH)) {
    console.warn("⚠️ No blacklist file found.");
    return new Set();
  }

  const raw = JSON.parse(fs.readFileSync(BLACKLIST_PATH, "utf8"));
  const set = new Set<string>();

  if (Array.isArray(raw)) {
    for (const t of raw) {
      if (typeof t === "string") {
        set.add(normalizeTagString(t));
      }
    }
  }

  console.log(`🛑 Loaded ${set.size} blacklisted tags.`);
  return set;
}

function readSongFile(fullPath: string): any | null {
  try {
    const content = fs.readFileSync(fullPath, "utf8");
    return JSON.parse(content);
  } catch (err) {
    console.warn(`⚠️ Could not parse song file: ${fullPath}`, err);
    return null;
  }
}

function getSongId(fileName: string, data: any): string {
  if (data && typeof data.id === "string" && data.id.trim().length > 0) {
    return data.id.trim();
  }
  return path.basename(fileName, path.extname(fileName));
}

function collectTagsFromSong(
  fileName: string,
  data: any,
): { raw: RawTagRecord[]; removed: RawTagRecord[] } {
  const songId = getSongId(fileName, data);
  const raw: RawTagRecord[] = [];
  const removed: RawTagRecord[] = [];

  function processTag(rawValue: string, source: string) {
    const normalized = normalizeTagString(rawValue);

    const record: RawTagRecord = {
      songId,
      tag: rawValue,
      normalized,
      source
    };

    if (blacklist.has(normalized)) {
      removed.push(record);
    } else {
      raw.push(record);
    }
  }

  // local tags
  if (Array.isArray(data.tags)) {
    for (const t of data.tags) {
      if (typeof t === "string" && t.trim()) {
        processTag(t, "local");
      }
    }
  }

  // external sources
  for (const [containerKey, fieldKey, label] of TAG_SOURCES) {
    const container = data[containerKey];
    if (!container || typeof container !== "object") continue;

    const values = (container as any)[fieldKey];
    if (!Array.isArray(values)) continue;

    for (const t of values) {
      if (typeof t === "string" && t.trim()) {
        processTag(t, label);
      }
    }
  }

  return { raw, removed };
}

// ============================================================
// MAIN STAGE FUNCTION
// ============================================================

let blacklist: Set<string>; // global inside module

export async function runCollectTagsStage(
  songsDir: string = SONGS_DIR,
  outputPath: string = OUTPUT_PATH,
  removedPath: string = BLACKLIST_OUTPUT,
): Promise<void> {
  if (!fs.existsSync(songsDir)) {
    console.error(`❌ SONGS_DIR does not exist: ${songsDir}`);
    process.exit(1);
  }

  blacklist = loadBlacklist();

  ensureFileDir(outputPath);
  ensureFileDir(removedPath);

  fs.writeFileSync(outputPath, "", "utf8");
  fs.writeFileSync(removedPath, "", "utf8");

  const files = fs
    .readdirSync(songsDir)
    .filter((f) => f.endsWith(".json") || f.endsWith(".json5"));

  console.log(`📂 Found ${files.length} song files in ${songsDir}`);

  let keptCount = 0;
  let removedCount = 0;

  for (const file of files) {
    const fullPath = path.join(songsDir, file);
    const data = readSongFile(fullPath);
    if (!data) continue;

    const { raw, removed } = collectTagsFromSong(file, data);

    for (const r of raw) appendJsonl(outputPath, r);
    for (const r of removed) appendJsonl(removedPath, r);

    keptCount += raw.length;
    removedCount += removed.length;
  }

  console.log(`✅ Kept tags: ${keptCount}`);
  console.log(`🛑 Removed blacklisted: ${removedCount}`);
  console.log(`📄 Output → ${outputPath}`);
  console.log(`📄 Removed → ${removedPath}`);
}

// ============================================================
// CLI ENTRY
// ============================================================

async function main() {
  await runCollectTagsStage();
}

void main();
