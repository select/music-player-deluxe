#!/usr/bin/env node
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

// ============================================================
// TYPES
// ============================================================

export type PartType = "style" | "descriptor" | "invalid";

export type TagBucket =
  | "STYLE_ONLY"
  | "STYLE_WITH_DESCRIPTORS"
  | "DESCRIPTORS_ONLY"
  | "PURE_INVALID";

export interface TagPostProcessEntry {
  normalized: string;
  totalCount: number;
  styles: string[];
  descriptors: string[];
  invalidParts: string[];
  bucket: TagBucket;
}

// Style harvest output
export interface RawStyleEntry {
  style: string;
  totalCount: number;          // sum over all tags where this style appears
  tagCount: number;            // number of normalized tags containing this style
  exampleTags: string[];       // some normalized tags for context
}

// Canonicalization mapping
export type StyleCanonicalAction = "keep" | "alias" | "reject";

export interface StyleCanonicalEntry {
  style: string;               // original style string
  canonical_style: string;     // final chosen canonical form
  totalCount: number;
  action: StyleCanonicalAction;
  reason: string;
}

// ============================================================
// RUNTIME SETUP / CONFIG
// ============================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Input from Stage 4
const TAG_POSTPROCESSED_PATH = path.join(
  __dirname,
  "../../data/tag-map-pipeline/tag-compound-postprocessed.jsonl",
);

// Style harvest output
const STYLE_RAW_SUMMARY_PATH = path.join(
  __dirname,
  "../../data/tag-map-pipeline/style-raw-summary.jsonl",
);

// Canonicalization output
const STYLE_CANONICAL_MAP_PATH = path.join(
  __dirname,
  "../../data/tag-map-pipeline/style-canonical-map.jsonl",
);

// Ollama / model config (re-use from Stage 3)
const MODEL_NAME = "gemma3:4b";
const OLLAMA_HOST = "http://localhost:11434";

const STYLE_PROMPT_PATH = path.join(
  __dirname,
  "../../prompts/style-canonicalization-v1.txt", // TODO: create this prompt file
);

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
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const content = fs.readFileSync(filePath, "utf8");
  return content
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

function appendJsonl(filePath: string, obj: unknown) {
  fs.appendFileSync(filePath, JSON.stringify(obj) + "\n", "utf8");
}

export function normalizeStyleKey(s: string): string {
  return s
    .normalize("NFKC")     // Unicode normalize
    .toLowerCase()         // case-insensitive
    .replace(/\s+/g, " ")  // collapse internal whitespace
    .trim();               // remove leading/trailing whitespace
}

// ============================================================
// HARVEST: BUILD STYLE UNIVERSE FROM TAGS
// ============================================================

function harvestStylesFromTags(
  entries: TagPostProcessEntry[],
  maxExamplesPerStyle = 5,
): RawStyleEntry[] {
  const map = new Map<string, RawStyleEntry>();

  for (const entry of entries) {
    // only pay attention to tags that actually have styles
    if (!entry.styles || entry.styles.length === 0) continue;

    const uniqueStyles = new Set(entry.styles);

    for (const style of uniqueStyles) {
      if (!style || !style.trim()) continue;
      const key = normalizeStyleKey(style);

      let rec = map.get(key);
      if (!rec) {
        rec = {
          style: key,
          totalCount: 0,
          tagCount: 0,
          exampleTags: [],
        };
        map.set(key, rec);
      }

      // totalCount: sum of tag totalCounts
      rec.totalCount += entry.totalCount;
      rec.tagCount += 1;

      if (rec.exampleTags.length < maxExamplesPerStyle) {
        rec.exampleTags.push(entry.normalized);
      }
    }
  }

  return Array.from(map.values()).sort(
    (a, b) => b.totalCount - a.totalCount,
  );
}

export async function runStyleHarvestStage(
  inputPath: string = TAG_POSTPROCESSED_PATH,
  outputPath: string = STYLE_RAW_SUMMARY_PATH,
): Promise<void> {
  console.log(`📥 Reading postprocessed tags from: ${inputPath}`);

  const lines = readJsonlLines(inputPath);
  const entries: TagPostProcessEntry[] = [];

  for (const line of lines) {
    try {
      const rec = JSON.parse(line) as TagPostProcessEntry;
      if (rec && typeof rec.normalized === "string") {
        entries.push(rec);
      }
    } catch {
      console.warn("⚠️ Skipping invalid JSONL line:", line);
    }
  }

  console.log(`🔢 Loaded ${entries.length} TagPostProcessEntry items`);

  const styles = harvestStylesFromTags(entries);

  ensureFileDir(outputPath);
  fs.writeFileSync(outputPath, "", "utf8");

  for (const s of styles) {
    appendJsonl(outputPath, s);
  }

  console.log(`✅ Style harvest complete.`);
  console.log(`🎵 Unique styles: ${styles.length}`);
  console.log(`📄 Output → ${outputPath}`);
}

// ============================================================
// OLLAMA / PROMPT HELPERS (FOR CANONICALIZATION)
// ============================================================

function loadBasePrompt(filePath: string): string {
  return fs.readFileSync(filePath, "utf8");
}

function buildStylePrompt(basePrompt: string, styleEntry: RawStyleEntry): string {
  const inputJson = JSON.stringify(styleEntry, null, 2);
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

// Single-style canonicalization via LLM
async function analyzeStyleCanonicalization(
  basePrompt: string,
  styleEntry: RawStyleEntry,
): Promise<StyleCanonicalEntry> {
  const prompt = buildStylePrompt(basePrompt, styleEntry);
  const data = await ollamaGenerate(MODEL_NAME, prompt);
  let raw = data.response.trim();

  // In case the model still returns ``` fences, strip them
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

  // Expect the model to output something like:
  // {
  //   "style": "<original>",
  //   "canonical_style": "<canonical>",
  //   "action": "keep" | "alias" | "reject",
  //   "reason": "..."
  // }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Model output is not a valid StyleCanonicalEntry object");
  }

  const entry: StyleCanonicalEntry = {
    style: styleEntry.style,
    canonical_style: String(parsed.canonical_style ?? styleEntry.style),
    totalCount: styleEntry.totalCount,
    action: (parsed.action as StyleCanonicalAction) ?? "keep",
    reason: String(parsed.reason ?? ""),
  };

  return entry;
}

// ============================================================
// STYLE CANONICALIZATION DRIVER
// ============================================================

export async function runStyleCanonicalizationStage(
  inputPath: string = STYLE_RAW_SUMMARY_PATH,
  outputPath: string = STYLE_CANONICAL_MAP_PATH,
  limit?: number,
): Promise<void> {
  console.log(`📥 Reading raw style summary from: ${inputPath}`);

  const lines = readJsonlLines(inputPath);
  const styles: RawStyleEntry[] = [];

  for (const line of lines) {
    try {
      const rec = JSON.parse(line) as RawStyleEntry;
      if (rec && typeof rec.style === "string") {
        styles.push(rec);
      }
    } catch {
      console.warn("⚠️ Skipping invalid JSONL line:", line);
    }
  }

  console.log(`🔢 Loaded ${styles.length} RawStyleEntry items`);

  ensureFileDir(outputPath);

  // Resume support: which styles already canonicalized?
  const doneStyles = new Set<string>();
  const existingLines = readJsonlLines(outputPath);
  for (const line of existingLines) {
    try {
      const rec = JSON.parse(line) as StyleCanonicalEntry;
      if (rec && typeof rec.style === "string") {
        doneStyles.add(rec.style);
      } else {
        console.warn(`Invalid record or style: ${line}`);
      } 
    } catch (error) {
        console.error(`Error parsing line: ${line}`, error);
      }
    }

  console.log(`🔢 Found ${doneStyles.size} processed RawStyleEntry items`);
    console.log(`🔢 Processing ${styles.length - doneStyles.size} new RawStyleEntry items`);

    const basePrompt = loadBasePrompt(STYLE_PROMPT_PATH);

    let processed = 0;
    const toProcess =
      typeof limit === "number" ? styles.slice(0, limit) : styles;

    for (const styleEntry of toProcess) {
      if (doneStyles.has(styleEntry.style)) {
        continue; // skip already processed styles
      }

      console.log(
        `🎯 Canonicalizing style "${styleEntry.style}" (count=${styleEntry.totalCount})...`,
      );

      // TODO: you can add heuristics here before calling the model, e.g.
      // if (styleEntry.totalCount < 3) maybe skip or treat differently.

      const canonical = await analyzeStyleCanonicalization(
        basePrompt,
        styleEntry,
      );

      appendJsonl(outputPath, canonical);
      processed += 1;
    }

    console.log(
      `✅ Style canonicalization complete. Newly processed: ${processed}, total: ${styles.length}`,
    );
    console.log(`📄 Output → ${outputPath}`);
  }

  // ============================================================
  // CLI ENTRY
  // ============================================================
  //
  // Usage:
  //   pnpm tsx scripts/stage-style-normalize.ts harvest
  //   pnpm tsx scripts/stage-style-normalize.ts canonicalize
  //   pnpm tsx scripts/stage-style-normalize.ts all
  //

  async function main() {
    const mode = process.argv[2] ?? "all";

    try {
      if (mode === "harvest") {
        await runStyleHarvestStage();
      } else if (mode === "canonicalize") {
        await runStyleCanonicalizationStage();
      } else {
        // default: run both stages in order
        await runStyleHarvestStage();
        await runStyleCanonicalizationStage();
      }
    } catch (err) {
      console.error("❌ Error in style-normalize stage:", err);
      process.exit(1);
    }
  }

  void main();
