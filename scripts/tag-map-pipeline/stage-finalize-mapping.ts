#!/usr/bin/env node
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

// ============================================================
// TYPES
// ============================================================

// From Stage 5D
export interface TagStyleMapEntry {
  normalized: string;
  totalCount: number;
  canonicalStyles: string[];
  parentGenres: string[];
  // descriptors: string[];          // <-- NOT USED YET (future feature)
}

export interface FinalMappingFile {
  updated_at: string;
  mappings: Record<string, string[]>;
}

// ============================================================
// PATH SETUP
// ============================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Input from Stage 5D
const TAG_STYLE_MAP_PATH = path.join(
  __dirname,
  "../../data/tag-map-pipeline/tag-style-map.jsonl",
);

// Output (APP NEEDS THIS):
const FINAL_MAPPING_PATH = path.join(
  __dirname,
  "../../server/assets/tag-expanded-mappings.json",
);

// ============================================================
// HELPERS
// ============================================================

function readJsonl<T>(filePath: string): T[] {
  if (!fs.existsSync(filePath)) return [];
  return fs
    .readFileSync(filePath, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l) as T);
}

function ensureDir(filePath: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function dedupePreserveOrder<T>(values: T[]): T[] {
  const seen = new Set<T>();
  const out: T[] = [];
  for (const v of values) {
    if (!seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  return out;
}

// ============================================================
// CORE: BUILD MAPPINGS
// ============================================================

function buildExpandedGenreMappings(
  tagStyleEntries: TagStyleMapEntry[],
): Record<string, string[]> {
  const mappings: Record<string, string[]> = {};

  for (const entry of tagStyleEntries) {
    const normalized = entry.normalized;

    // ---------------------------
    // GENRE EXPANSION LOGIC ONLY
    // ---------------------------

    const expanded = dedupePreserveOrder([
      ...(entry.canonicalStyles ?? []),
      ...(entry.parentGenres ?? []),
    ]).filter((t) => t && t.trim().length > 0);

    if (expanded.length === 0) continue;

    // merge if exists
    const existing = mappings[normalized] ?? [];
    mappings[normalized] = dedupePreserveOrder([...existing, ...expanded]);

    // ---------------------------
    // DESCRIPTOR EXPANSION DEFERRED
    // Uncomment when descriptor pipeline exists:
    //
    // if (!expanded.length && entry.descriptors?.length) {
    //   mappings[normalized] = entry.descriptors;
    // }
    // ---------------------------
  }

  return mappings;
}

// ============================================================
// WRITE FINAL FILE
// ============================================================

function writeFinalMappingJSON(
  mappings: Record<string, string[]>,
  filePath: string = FINAL_MAPPING_PATH,
) {
  const out: FinalMappingFile = {
    updated_at: new Date().toISOString(),
    mappings,
  };

  ensureDir(filePath);
  fs.writeFileSync(filePath, JSON.stringify(out, null, 2), "utf8");

  console.log(`📄 Final tag mapping written → ${filePath}`);
}

// ============================================================
// MAIN DRIVER
// ============================================================

export async function runFinalizeMappingStage(): Promise<void> {
  console.log("📥 Loading tag-style-map...");
  const tagStyleEntries = readJsonl<TagStyleMapEntry>(TAG_STYLE_MAP_PATH);
  console.log(`🔢 Loaded ${tagStyleEntries.length} style entries`);

  console.log("🧱 Building genre expansion mappings...");
  const mappings = buildExpandedGenreMappings(tagStyleEntries);

  console.log("💾 Writing final combined mapping file...");
  writeFinalMappingJSON(mappings, FINAL_MAPPING_PATH);

  console.log("✅ Stage-finalize-mapping complete.");
}

// CLI entry
(async () => {
  try {
    await runFinalizeMappingStage();
  } catch (err) {
    console.error("❌ Error in stage-finalize-mapping:", err);
    process.exit(1);
  }
})();
