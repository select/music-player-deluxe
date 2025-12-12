#!/usr/bin/env node
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

// ============================================================
// TYPES (keep in sync with Stage 5A/B)
// ============================================================

export type StyleCanonicalAction = "keep" | "alias" | "reject";

export interface RawStyleEntry {
  style: string;
  totalCount: number;
  tagCount: number;
  exampleTags: string[];
}

export interface StyleCanonicalEntry {
  style: string;               // original style string
  canonical_style: string;     // normalized / final style
  action: StyleCanonicalAction;
  reason: string;
}

// Input to the hierarchy model (combined info per canonical style)
export interface CanonicalStyleWithStats {
  canonical_style: string;
  totalCount: number;          // sum from all raw styles that map here
  tagCount: number;
  exampleTags: string[];       // merged examples (limited)
}

// Output of this stage
export interface StyleHierarchyEntry {
  style: string;               // canonical style
  totalCount: number;
  is_subgenre: boolean;
  parent_genre: string;        // "" if none / broad genre
  reason: string;
}

// ============================================================
// RUNTIME SETUP / CONFIG
// ============================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// NOTE: scripts are in:  ../scripts/tag-map-pipeline/
// data files are in:     ../../data/tag-map-pipeline/

// Input from style-harvest (Stage 5A)
const STYLE_RAW_SUMMARY_PATH = path.join(
  __dirname,
  "../../data/tag-map-pipeline/style-raw-summary.jsonl",
);

// Input from style-canonicalization (Stage 5B)
const STYLE_CANONICAL_MAP_PATH = path.join(
  __dirname,
  "../../data/tag-map-pipeline/style-canonical-map.jsonl",
);

// Output of this stage
const STYLE_HIERARCHY_PATH = path.join(
  __dirname,
  "../../data/tag-map-pipeline/style-hierarchy.jsonl",
);

// Prompts (adjust if your layout differs)
const STYLE_HIERARCHY_PROMPT_PATH = path.join(
  __dirname,
  "../../prompts/style-hierarchy-v1.txt",
);

// Model / Ollama
const MODEL_NAME = "gemma3:4b";
const OLLAMA_HOST = "http://localhost:11434";

// ============================================================
// FS HELPERS
// ============================================================

function ensureFileDir(filePath: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readJsonlLines(filePath: string): string[] {
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, "utf8");
  return content
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

function appendJsonl(filePath: string, obj: unknown) {
  fs.appendFileSync(filePath, JSON.stringify(obj) + "\n", "utf8");
}

// ============================================================
// COMBINE RAW STYLE STATS + CANONICAL MAP
// ============================================================

function buildCanonicalStyleStats(
  rawStyles: RawStyleEntry[],
  canonicalEntries: StyleCanonicalEntry[],
  maxExamplesPerCanonical = 10,
): CanonicalStyleWithStats[] {
  const canonicalByStyle = new Map<string, StyleCanonicalEntry>();
  for (const c of canonicalEntries) {
    canonicalByStyle.set(c.style, c);
  }

  const agg = new Map<string, CanonicalStyleWithStats>();

  for (const raw of rawStyles) {
    const c = canonicalByStyle.get(raw.style);
    if (!c) continue;
    if (c.action === "reject") continue;

    const canonicalStyle =
      c.canonical_style && c.canonical_style.trim().length > 0
        ? c.canonical_style.trim()
        : raw.style;

    let rec = agg.get(canonicalStyle);
    if (!rec) {
      rec = {
        canonical_style: canonicalStyle,
        totalCount: 0,
        tagCount: 0,
        exampleTags: [],
      };
      agg.set(canonicalStyle, rec);
    }

    rec.totalCount += raw.totalCount;
    rec.tagCount += raw.tagCount;

    for (const t of raw.exampleTags) {
      if (rec.exampleTags.length >= maxExamplesPerCanonical) break;
      if (!rec.exampleTags.includes(t)) {
        rec.exampleTags.push(t);
      }
    }
  }

  return Array.from(agg.values()).sort(
    (a, b) => b.totalCount - a.totalCount,
  );
}

// ============================================================
// OLLAMA / PROMPT HELPERS
// ============================================================

function loadBasePrompt(filePath: string): string {
  return fs.readFileSync(filePath, "utf8");
}

function buildHierarchyPrompt(
  basePrompt: string,
  style: CanonicalStyleWithStats,
): string {
  const inputJson = JSON.stringify(style, null, 2);
  return `${basePrompt.trim()}

### INPUT
${inputJson}

### OUTPUT
`;
}

async function ollamaGenerate(model: string, prompt: string) {
  const response = await fetch(`${OLLAMA_HOST}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `HTTP error from Ollama: ${response.status} ${response.statusText} – ${text}`,
    );
  }

  return (await response.json()) as { response: string };
}

async function analyzeStyleHierarchy(
  basePrompt: string,
  style: CanonicalStyleWithStats,
): Promise<StyleHierarchyEntry> {
  const prompt = buildHierarchyPrompt(basePrompt, style);
  const data = await ollamaGenerate(MODEL_NAME, prompt);
  let raw = data.response.trim();

  if (raw.startsWith("```")) {
    raw = raw.replace(/^```(?:json)?\s*/i, "");
    raw = raw.replace(/```$/, "");
    raw = raw.trim();
  }

  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.error("Failed to parse JSON from model:", raw);
    throw err;
  }

  const entry: StyleHierarchyEntry = {
    style: style.canonical_style,
    totalCount: style.totalCount,
    is_subgenre: Boolean(parsed.is_subgenre),
    parent_genre: String(parsed.parent_genre ?? ""),
    reason: String(parsed.reason ?? ""),
  };

  return entry;
}

// ============================================================
// DRIVER
// ============================================================

export async function runStyleHierarchyStage(
  rawStylePath: string = STYLE_RAW_SUMMARY_PATH,
  canonicalMapPath: string = STYLE_CANONICAL_MAP_PATH,
  outputPath: string = STYLE_HIERARCHY_PATH,
  limit?: number,
): Promise<void> {
  console.log(`📥 Reading raw style summary from: ${rawStylePath}`);
  const rawLines = readJsonlLines(rawStylePath);
  const rawStyles: RawStyleEntry[] = [];
  for (const line of rawLines) {
    try {
      const rec = JSON.parse(line) as RawStyleEntry;
      if (rec && typeof rec.style === "string") rawStyles.push(rec);
    } catch {
      console.warn("⚠️ Skipping invalid raw style line:", line);
    }
  }
  console.log(`🔢 Loaded ${rawStyles.length} RawStyleEntry items`);

  console.log(`📥 Reading canonical style map from: ${canonicalMapPath}`);
  const canonLines = readJsonlLines(canonicalMapPath);
  const canonicalEntries: StyleCanonicalEntry[] = [];
  for (const line of canonLines) {
    try {
      const rec = JSON.parse(line) as StyleCanonicalEntry;
      if (rec && typeof rec.style === "string") canonicalEntries.push(rec);
    } catch {
      console.warn("⚠️ Skipping invalid canonical map line:", line);
    }
  }
  console.log(
    `🔢 Loaded ${canonicalEntries.length} StyleCanonicalEntry items`,
  );

  const canonicalStats = buildCanonicalStyleStats(rawStyles, canonicalEntries);
  console.log(
    `🎵 Canonical styles to analyze (with stats): ${canonicalStats.length}`,
  );

  ensureFileDir(outputPath);

  // Resume support
  const alreadyDone = new Set<string>();
  const existingLines = readJsonlLines(outputPath);
  for (const line of existingLines) {
    try {
      const rec = JSON.parse(line) as StyleHierarchyEntry;
      if (rec && typeof rec.style === "string") {
        alreadyDone.add(rec.style);
      }
    } catch {
      // ignore
    }
  }

  const basePrompt = loadBasePrompt(STYLE_HIERARCHY_PROMPT_PATH);

  let processed = 0;
  const toProcess =
    typeof limit === "number" ? canonicalStats.slice(0, limit) : canonicalStats;

  for (const style of toProcess) {
    if (alreadyDone.has(style.canonical_style)) continue;

    console.log(
      `🎯 Analyzing hierarchy for "${style.canonical_style}" (count=${style.totalCount})...`,
    );

    const result = await analyzeStyleHierarchy(basePrompt, style);
    appendJsonl(outputPath, result);
    processed += 1;
  }

  console.log(
    `✅ Style hierarchy stage complete. Newly processed: ${processed}, total canonical styles: ${canonicalStats.length}`,
  );
  console.log(`📄 Output → ${outputPath}`);
}

// ============================================================
// CLI ENTRY
// ============================================================
//
// Usage:
//   pnpm tsx scripts/tag-map-pipeline/stage-style-hierarchy.ts
//   pnpm tsx scripts/tag-map-pipeline/stage-style-hierarchy.ts 200
//

async function main() {
  const arg = process.argv[2];
  const limit = arg ? Number(arg) : undefined;

  try {
    await runStyleHierarchyStage(
      STYLE_RAW_SUMMARY_PATH,
      STYLE_CANONICAL_MAP_PATH,
      STYLE_HIERARCHY_PATH,
      Number.isFinite(limit) ? limit : undefined,
    );
  } catch (err) {
    console.error("❌ Error in style-hierarchy stage:", err);
    process.exit(1);
  }
}

void main();
