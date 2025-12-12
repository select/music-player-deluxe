#!/usr/bin/env node
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================
// CONFIG
// ============================================================

const INPUT_PATH = path.join(__dirname, "../../data/tag-map-pipeline/tag-source-raw.jsonl");
const OUTPUT_PATH = path.join(__dirname, "../../data/tag-map-pipeline/tag-normalized.jsonl");

// ============================================================
// TYPES
// ============================================================

export interface RawTagRecord {
  songId: string;
  tag: string;
  normalized: string;
  source: string;
}

export interface NormalizedTagEntry {
  normalized: string;
  totalCount: number;
  songCount: number;
  sources: Record<string, number>;
  rawExamples: string[];
}

// Internal aggregation structure
interface NormalizedTagAgg {
  normalized: string;
  totalCount: number;
  songIds: Set<string>;
  sources: Map<string, number>;
  rawExamples: Set<string>;
}

// ============================================================
// HELPERS
// ============================================================

function ensureFileDir(filePath: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function appendJsonl(filePath: string, obj: unknown) {
  fs.appendFileSync(filePath, JSON.stringify(obj) + "\n", "utf8");
}

function readJsonlLines(filePath: string): string[] {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Input file does not exist: ${filePath}`);
  }
  const content = fs.readFileSync(filePath, "utf8");
  return content
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

// ============================================================
// CORE LOGIC
// ============================================================

export async function runNormalizeTagsStage(
  inputPath: string = INPUT_PATH,
  outputPath: string = OUTPUT_PATH,
): Promise<void> {
  console.log(`📥 Reading raw tags from: ${inputPath}`);

  const lines = readJsonlLines(inputPath);
  console.log(`📄 Found ${lines.length} raw tag records`);

  const byNorm = new Map<string, NormalizedTagAgg>();

  for (const line of lines) {
    let rec: RawTagRecord;
    try {
      rec = JSON.parse(line) as RawTagRecord;
    } catch (err) {
      console.warn("⚠️ Skipping invalid JSONL line:", line);
      continue;
    }

    if (!rec.normalized || typeof rec.normalized !== "string") {
      console.warn("⚠️ Missing normalized field, skipping:", rec);
      continue;
    }

    const key = rec.normalized;
    let agg = byNorm.get(key);
    if (!agg) {
      agg = {
        normalized: key,
        totalCount: 0,
        songIds: new Set<string>(),
        sources: new Map<string, number>(),
        rawExamples: new Set<string>(),
      };
      byNorm.set(key, agg);
    }

    agg.totalCount += 1;
    agg.songIds.add(rec.songId);

    const prevCount = agg.sources.get(rec.source) ?? 0;
    agg.sources.set(rec.source, prevCount + 1);

    if (agg.rawExamples.size < 5) {
      agg.rawExamples.add(rec.tag);
    }
  }

  console.log(`🔢 Unique normalized tags: ${byNorm.size}`);

  ensureFileDir(outputPath);
  fs.writeFileSync(outputPath, "", "utf8");

  const entries: NormalizedTagEntry[] = [];

  for (const agg of byNorm.values()) {
    const sourcesObj: Record<string, number> = {};
    for (const [src, count] of agg.sources.entries()) {
      sourcesObj[src] = count;
    }

    const entry: NormalizedTagEntry = {
      normalized: agg.normalized,
      totalCount: agg.totalCount,
      songCount: agg.songIds.size,
      sources: sourcesObj,
      rawExamples: Array.from(agg.rawExamples),
    };

    entries.push(entry);
    appendJsonl(outputPath, entry);
  }

  console.log(`✅ Wrote ${entries.length} normalized entries → ${outputPath}`);
}

// ============================================================
// CLI ENTRY
// ============================================================

async function main() {
  try {
    await runNormalizeTagsStage();
  } catch (err) {
    console.error("❌ Error in normalize-tags stage:", err);
    process.exit(1);
  }
}

void main();
