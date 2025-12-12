#!/usr/bin/env node
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

// ============================================================
// TYPES
// ============================================================

export type PartType = "style" | "descriptor" | "invalid";

export interface TagPart {
    text: string;
    type: PartType;
    reason: string;
}

export interface TagCompoundEntry {
    normalized: string;
    totalCount: number;
    parts: TagPart[];
}

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

export interface AutoBlacklistCandidate {
    normalized: string;
    totalCount: number;
    parts: TagPart[];
    reason: string;
}

// ============================================================
// RUNTIME SETUP / CONFIG
// ============================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_INPUT_PATH = path.join(
    __dirname,
    "../../data/tag-map-pipeline/tag-compound-stage.jsonl",
);

const OVERRIDE_PATH = path.join(
    __dirname,
    "../../data/tag-map-pipeline/tag-compound-stage-override.jsonl",
);

const OUTPUT_PATH = path.join(
    __dirname,
    "../../data/tag-map-pipeline/tag-compound-postprocessed.jsonl",
);

const BLACKLIST_CANDIDATES_PATH = path.join(
    __dirname,
    "../../data/tag-map-pipeline/tag-auto-blacklist-candidates.jsonl",
);

// ============================================================
// HELPERS
// ============================================================

function ensureFileDir(filePath: string) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function appendJsonl(filePath: string, obj: unknown) {
    fs.appendFileSync(filePath, JSON.stringify(obj) + "\n", "utf8");
}

function readJsonlLines(filePath: string): string[] {
    if (!fs.existsSync(filePath)) return [];
    const content = fs.readFileSync(filePath, "utf8");
    return content.split("\n").map((l) => l.trim()).filter(Boolean);
}

function dedupePreserveOrder(values: string[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const v of values) if (!seen.has(v)) { seen.add(v); out.push(v); }
    return out;
}

function decideBucket(styles: string[], descriptors: string[]): TagBucket {
    if (styles.length > 0 && descriptors.length > 0) return "STYLE_WITH_DESCRIPTORS";
    if (styles.length > 0) return "STYLE_ONLY";
    if (descriptors.length > 0) return "DESCRIPTORS_ONLY";
    return "PURE_INVALID";
}

// Replace reasons for any override entry
function applyOverrideReason(entry: TagCompoundEntry): TagCompoundEntry {
    return {
        ...entry,
        parts: entry.parts.map((p) => ({
            ...p,
            reason: "Manually corrected via tag-compound-stage-override.ts file",
        })),
    };
}

// ============================================================
// CORE STAGE
// ============================================================

export async function runTagCompoundPostprocessStage(
    baseInputPath: string = BASE_INPUT_PATH,
    overridePath: string = OVERRIDE_PATH,
    outputPath: string = OUTPUT_PATH,
    blacklistCandidatesPath: string = BLACKLIST_CANDIDATES_PATH,
): Promise<void> {
    console.log(`📥 Reading base compound tags from: ${baseInputPath}`);
    const baseLines = readJsonlLines(baseInputPath);

    console.log(`📥 Reading overrides from: ${overridePath}`);
    const overrideLines = readJsonlLines(overridePath);

    const byNormalized = new Map<string, TagCompoundEntry>();

    // 1) Load base entries
    for (const line of baseLines) {
        try {
            const rec = JSON.parse(line) as TagCompoundEntry;
            if (rec?.normalized && Array.isArray(rec.parts)) {
                byNormalized.set(rec.normalized, rec);
            }
        } catch {
            console.warn("⚠️ Skipping invalid base line:", line);
        }
    }

    const baseCount = byNormalized.size;

    // 2) Load overrides
    let overrideApplied = 0;
    let overrideNew = 0;

    for (const line of overrideLines) {
        try {
            const rec = JSON.parse(line) as TagCompoundEntry;
            if (!rec?.normalized || !Array.isArray(rec.parts)) continue;

            const corrected = applyOverrideReason(rec);

            if (byNormalized.has(rec.normalized)) overrideApplied++;
            else overrideNew++;

            byNormalized.set(rec.normalized, corrected);

        } catch {
            console.warn("⚠️ Skipping invalid override line:", line);
        }
    }

    console.log(`🔢 Base entries: ${baseCount}`);
    console.log(`🔁 Overrides applied: ${overrideApplied}`);
    console.log(`➕ Overrides added new: ${overrideNew}`);
    console.log(`📦 Total merged entries: ${byNormalized.size}`);

    ensureFileDir(outputPath);
    ensureFileDir(blacklistCandidatesPath);

    fs.writeFileSync(outputPath, "", "utf8");
    fs.writeFileSync(blacklistCandidatesPath, "", "utf8");

    let pureInvalidCount = 0;

    for (const entry of byNormalized.values()) {
        const styles = dedupePreserveOrder(entry.parts.filter(p => p.type === "style").map(p => p.text));
        const descriptors = dedupePreserveOrder(entry.parts.filter(p => p.type === "descriptor").map(p => p.text));
        const invalidParts = dedupePreserveOrder(entry.parts.filter(p => p.type === "invalid").map(p => p.text));

        const bucket = decideBucket(styles, descriptors);

        const post: TagPostProcessEntry = {
            normalized: entry.normalized,
            totalCount: entry.totalCount,
            styles,
            descriptors,
            invalidParts,
            bucket,
        };

        appendJsonl(outputPath, post);

        if (bucket === "PURE_INVALID") {
            pureInvalidCount++;
            const candidate: AutoBlacklistCandidate = {
                normalized: entry.normalized,
                totalCount: entry.totalCount,
                parts: entry.parts, // includes all TagPart items (all invalid in this bucket)
                reason: "PURE_INVALID (no styles or descriptors; only invalid parts)",
            };

            appendJsonl(blacklistCandidatesPath, candidate);
        }
    }

    console.log(`✅ Postprocess + overrides complete`);
    console.log(`📄 Output → ${outputPath}`);
    console.log(`📄 Blacklist candidates: ${pureInvalidCount} tags → ${blacklistCandidatesPath}`);
}

// ============================================================
// CLI ENTRY
// ============================================================

async function main() {
    try {
        await runTagCompoundPostprocessStage();
    } catch (err) {
        console.error("❌ Error in tag-compound-postprocess stage:", err);
        process.exit(1);
    }
}

void main();
