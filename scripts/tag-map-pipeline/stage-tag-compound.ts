#!/usr/bin/env node
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

// ============================================================
// TYPES
// ============================================================

export type PartType =
    | "style"
    | "descriptor"
    | "invalid"

// not set in TagPart, analyzeCompoundTag
export type DescriptorCategory =
    | ""                // for style and noise
    | "mood"
    | "sound"
    | "instrumentation"
    | "origin"
    | "language"
    | "era"
    | "context"
    | "other";

export interface TagPart {
    text: string;
    type: PartType;
    //descriptor_category: DescriptorCategory;
    reason: string;
}

export interface CompoundTagAnalysis {
    source: string;
    parts: TagPart[];
}

export interface NormalizedTagEntry {
    normalized: string;
    totalCount: number;
    songCount: number;
    sources: Record<string, number>;
    rawExamples: string[];
}

export interface TagCompoundEntry {
    normalized: string;
    totalCount: number;
    parts: TagPart[];
}


// ============================================================
// RUNTIME SETUP / CONFIG
// ============================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MODEL_NAME = "gemma3:4b";
const OLLAMA_HOST = "http://localhost:11434";

const PROMPT_PATH = path.join(
    __dirname,
    "../../prompts/tag-compound-interpretation-v3.txt",
);

const INPUT_PATH = path.join(__dirname, "../../data/tag-map-pipeline/tag-normalized.jsonl");
const OUTPUT_PATH = path.join(__dirname, "../../data/tag-map-pipeline/tag-compound-stage.jsonl");

// ============================================================
// HELPER: FS BASICS
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

// For resume support: see which normalized tags are already present in output
function loadExistingNormalizedFromOutput(
    outputPath: string,
): Set<string> {
    const done = new Set<string>();

    if (!fs.existsSync(outputPath)) {
        return done;
    }

    const lines = readJsonlLines(outputPath);
    for (const line of lines) {
        try {
            const rec = JSON.parse(line) as TagCompoundEntry;
            if (rec && typeof rec.normalized === "string") {
                done.add(rec.normalized);
            }
        } catch {
            // ignore bad lines
        }
    }

    return done;
}

// ============================================================
// HELPER: PROMPT BUILDING
// ============================================================

function loadBasePrompt(filePath: string): string {
    return fs.readFileSync(filePath, "utf8");
}

function buildPrompt(basePrompt: string, tag: string): string {
    const inputJson = JSON.stringify({ tag }, null, 2);
    return `${basePrompt.trim()}

### INPUT
${inputJson}

### OUTPUT
`;
}

// ============================================================
// HELPER: OLLAMA CALL
// ============================================================

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

// ============================================================
// CORE: SINGLE TAG ANALYSIS
// ============================================================

async function analyzeCompoundTag(tag: string): Promise<CompoundTagAnalysis> {
    const basePrompt = loadBasePrompt(PROMPT_PATH);
    const prompt = buildPrompt(basePrompt, tag);

    const data = await ollamaGenerate(MODEL_NAME, prompt);
    let raw = data.response.trim();

    // Sanitize markdown fences if model ignores the "no fences" instruction
    if (raw.startsWith("```")) {
        // remove leading ``` or ```json
        raw = raw.replace(/^```(?:json)?\s*/i, "");
        // remove trailing ```
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

    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.parts)) {
        throw new Error("Model output is not a valid CompoundTagAnalysis object");
    }

    const parts: TagPart[] = parsed.parts.map((p: any) => ({
        text: String(p.text ?? "").trim(),
        type: p.type as PartType,
        reason: String(p.reason ?? ""),
    }));

    return {
        source: String(parsed.source ?? tag),
        parts,
    };
}

// ============================================================
// STAGE 3: TAG COMPOUND DRIVER
// ============================================================

export async function runTagCompoundStage(
    inputPath: string = INPUT_PATH,
    outputPath: string = OUTPUT_PATH,
    limit?: number,
): Promise<void> {
    console.log(`📥 Reading normalized tags from: ${inputPath}`);

    const lines = readJsonlLines(inputPath);
    const normalizedEntries: NormalizedTagEntry[] = [];

    for (const line of lines) {
        try {
            const rec = JSON.parse(line) as NormalizedTagEntry;
            if (rec && typeof rec.normalized === "string") {
                normalizedEntries.push(rec);
            }
        } catch (err) {
            console.warn("⚠️ Skipping invalid JSONL line:", line);
        }
    }

    // Sort tags by frequency (descending) so important tags run first.
    normalizedEntries.sort((a, b) => b.totalCount - a.totalCount);

    ensureFileDir(outputPath);

    const total = normalizedEntries.length;
    const alreadyDone = loadExistingNormalizedFromOutput(outputPath);
    const done = alreadyDone.size;
    const remaining = total - done;

    console.log(`Total unique normalized tags: ${total}`);
    console.log(`Already processed:            ${done}`);
    console.log(`Remaining:                    ${remaining}`);
    console.log(
        `Progress:                     ${((done / total) * 100).toFixed(1)}%`,
    );

    if (done === 0) {
        // No resume → start new file
        fs.writeFileSync(outputPath, "", "utf8");
    } else {
        console.log(`⏭ Resuming from previous run using ${outputPath}`);
    }


    let processed = 0;
    const toProcess =
        typeof limit === "number"
            ? normalizedEntries.slice(0, limit)
            : normalizedEntries;

    for (const entry of toProcess) {
        if (alreadyDone.has(entry.normalized)) {
            continue;
        }

        console.log(`🎯 Analyzing "${entry.normalized}" ...`);

        const analysis = await analyzeCompoundTag(entry.normalized);

        const out: TagCompoundEntry = {
            normalized: entry.normalized,
            totalCount: entry.totalCount,
            parts: analysis.parts,
        };


        appendJsonl(outputPath, out);
        processed += 1;
    }

    console.log(
        `✅ Stage 3 complete. Newly processed: ${processed}, total in input: ${normalizedEntries.length}`,
    );
    console.log(`📄 Output → ${outputPath}`);
}

// ============================================================
// CLI ENTRY
// ============================================================

async function main() {
    try {
        await runTagCompoundStage();
    } catch (err) {
        console.error("❌ Error in tag-compound stage:", err);
        process.exit(1);
    }
}

// This is a CLI script, just run it.
void main();
