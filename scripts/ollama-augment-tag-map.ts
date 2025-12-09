#!/usr/bin/env node

/**
 * ollama-augment-tag-map.ts
 *
 * Multi-stage tag mapping pipeline using Ollama (e.g. gemma3:4b).
 *
 * Stages:
 * 1) Canonicalizer (raw tag -> canonical single string)
 * 2) Splitter (canonical string -> parts[])
 * 3) Classifier (each part -> class)
 * 4) Descriptor extractor (genre_like, descriptors, invalid_descriptors)
 * 5) Subgenre mapper (subgenre -> parent genre)
 *
 * Output:
 *   data/tag-map-results.jsonl
 *   one TagMapEntry per original raw tag.
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

// ============================================================
// PATH / ESM SETUP
// ============================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================
// CONFIG
// ============================================================

const MODEL_NAME = process.env.TAG_MAP_MODEL ?? "gemma3:4b";
const OLLAMA_HOST = process.env.OLLAMA_HOST ?? "http://localhost:11434";

const SONGS_DIR = path.join(__dirname, "../server/assets/songs");
const RESULTS_PATH = path.join(__dirname, "../data/tag-map-results.jsonl");

const CANONICALIZER_PROMPT_PATH = path.join(
	__dirname,
	"../prompts/tag-canonicalizer-prompt.txt",
);
const SPLITTER_PROMPT_PATH = path.join(
	__dirname,
	"../prompts/tag-splitter-prompt.txt",
);
const CLASSIFIER_PROMPT_PATH = path.join(
	__dirname,
	"../prompts/tag-classifier-prompt.txt",
);
const DESCRIPTOR_PROMPT_PATH = path.join(
	__dirname,
	"../prompts/tag-descriptor-prompt.txt",
);
const SUBGENRE_PROMPT_PATH = path.join(
	__dirname,
	"../prompts/tag-subgenre-prompt.txt",
);

// How many unique tags per batch
const BATCH_SIZE = 1;

// Tag sources inside song JSONs
const TAG_SOURCES: Array<[string, string]> = [
	["lastfm", "tags"],
	["musicbrainz", "artistTags"],
	["musicbrainz", "artistGenres"],
	["musicbrainz", "genres"],
];

const BLACKLIST_PATH = path.join(__dirname, "../server/assets/tag-blacklist.json");

// ============================================================
// TYPES
// ============================================================

type TagClass =
	| "genre"
	| "subgenre"
	| "mood"
	| "descriptor"
	| "invalid"
	| "other";

interface OllamaChatMessage {
	role: "system" | "user" | "assistant";
	content: string;
}

interface OllamaChatResponse {
	message: {
		role: string;
		content: string;
	};
	// other fields ignored
}

type CanonicalAction =
	| "identity"
	| "abbreviation_to_full"
	| "alias_to_canonical"
	| "spellfix_to_canonical";

interface CanonicalTag {
	source: string;
	canonical: string;
	action: CanonicalAction;
	reason: string;
}

interface SplitResult {
	source: string;
	parts: string[];
	reason: string;
}

interface ClassifiedTag {
	source: string;
	class: TagClass;
	reason: string;
}

interface DescriptorInfo {
	source: string;
	genre_like: string;
	descriptors: string[];
	invalid_descriptors: string[];
	// short explanation
	reason: string;
}

interface SubgenreInfo {
	source: string;
	is_subgenre: boolean;
	parent_genre: string;
	reason: string;
}

interface TagMapEntry {
	// High-level info
	source: string;              // original raw tag as seen in metadata
	normalized_tags: string[];   // final tags after pipeline (explode + clean)
	tag_types: string[];         // aligned with normalized_tags
	canonical_stage: CanonicalTag;      // result of canonicalizer for this tag
	split_stage: SplitResult;           // split result for canonical.canonical
	classification_stage: ClassifiedTag[]; // classifier results for all relevant parts/descriptors
	descriptor_stage: DescriptorInfo[]; // descriptor info for all relevant parts
	subgenre_stage: SubgenreInfo[];     // subgenre info for relevant parts
	model: string;
	created_at: string;
}

// ============================================================
// SMALL UTILS
// ============================================================

function readTextFile(p: string): string {
	return fs.readFileSync(p, "utf8");
}

function readTextFileSafe(p: string): string | null {
	try {
		return fs.readFileSync(p, "utf8");
	} catch {
		return null;
	}
}

function ensureDirFor(filePath: string) {
	const dir = path.dirname(filePath);
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true });
	}
}

// JSONL helpers
function loadJsonl(p: string): any[] {
	if (!fs.existsSync(p)) return [];
	const text = fs.readFileSync(p, "utf8");
	return text
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => line.length > 0)
		.map((line) => {
			try {
				return JSON.parse(line);
			} catch (err) {
				console.warn("⚠️ Could not parse JSONL line:", line);
				return null;
			}
		})
		.filter((x) => x !== null);
}

function appendJsonl(p: string, objects: any[]) {
	if (!objects.length) return;
	ensureDirFor(p);
	const lines = objects.map((obj) => JSON.stringify(obj));
	fs.appendFileSync(p, lines.join("\n") + "\n", "utf8");
}

// A tiny, local normalization for safety (does NOT replace LLM canonicalization)
function normalizeTagString(s: string): string {
	return s
		.toLowerCase()
		.trim()
		.replace(/\s+/g, " ");
}

// ============================================================
// OLLAMA CHAT WRAPPER
// ============================================================

async function ollamaChat(
	model: string,
	messages: OllamaChatMessage[],
	host = OLLAMA_HOST,
	options: Record<string, unknown> = {},
): Promise<OllamaChatResponse> {
	const response = await fetch(`${host}/api/chat`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			model,
			messages,
			stream: false,
			options,
		}),
	});

	if (!response.ok) {
		const text = await response.text().catch(() => "");
		throw new Error(
			`HTTP error from Ollama: ${response.status} ${response.statusText} – ${text}`,
		);
	}

	return (await response.json()) as OllamaChatResponse;
}

// Clean model output to extract JSON
function cleanModelOutput(raw: string): string {
	let text = raw.trim();

	// Strip fenced ```json blocks if present
	const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
	if (fencedMatch) {
		text = fencedMatch[1].trim();
	}

	// If it doesn't start with [ or {, try to slice out a JSON array
	if (!text.startsWith("[") && !text.startsWith("{")) {
		const firstBracket = text.indexOf("[");
		const lastBracket = text.lastIndexOf("]");

		if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
			const sliced = text.slice(firstBracket, lastBracket + 1).trim();
			if (sliced.startsWith("[") && sliced.endsWith("]")) {
				text = sliced;
			}
		}
	}

	return text;
}

// Generic JSON parse helper
function parseJsonArray<T = any>(rawContent: string): T[] {
	const cleaned = cleanModelOutput(rawContent);

	let data: unknown;
	try {
		data = JSON.parse(cleaned);
	} catch (err) {
		console.error("\n❌ Model returned invalid JSON:\n");
		console.error(cleaned.slice(0, 1000));
		throw new Error("Model output is not valid JSON");
	}

	if (!Array.isArray(data)) {
		throw new Error(
			`Expected a JSON array from model, got: ${typeof data}`,
		);
	}

	return data as T[];
}

// ============================================================
// STAGE RUNNERS
// ============================================================

const CANONICALIZER_PROMPT = readTextFile(CANONICALIZER_PROMPT_PATH);
const SPLITTER_PROMPT = readTextFile(SPLITTER_PROMPT_PATH);
const CLASSIFIER_PROMPT = readTextFile(CLASSIFIER_PROMPT_PATH);
const DESCRIPTOR_PROMPT = readTextFile(DESCRIPTOR_PROMPT_PATH);
const SUBGENRE_PROMPT = readTextFile(SUBGENRE_PROMPT_PATH);

async function runCanonicalizerBatch(
	tags: string[],
	model = MODEL_NAME,
): Promise<CanonicalTag[]> {
	if (!tags.length) return [];
	const payload = JSON.stringify({ tags }, null, 0);

	const response = await ollamaChat(
		model,
		[
			{ role: "system", content: CANONICALIZER_PROMPT },
			{ role: "user", content: payload },
		],
		OLLAMA_HOST,
		{ temperature: 0, top_p: 0.1 },
	);

	const data = parseJsonArray<any>(response.message.content);

	return data.map((obj) => ({
		source: String(obj.source ?? ""),
		canonical: normalizeTagString(String(obj.canonical ?? "")),
		action: String(obj.action ?? "identity") as CanonicalAction,
		reason: String(obj.reason ?? ""),
	}));
}

async function runSplitterBatch(
	tags: string[],
	model = MODEL_NAME,
): Promise<SplitResult[]> {
	if (!tags.length) return [];
	const payload = JSON.stringify({ tags }, null, 0);

	const response = await ollamaChat(
		model,
		[
			{ role: "system", content: SPLITTER_PROMPT },
			{ role: "user", content: payload },
		],
		OLLAMA_HOST,
		{ temperature: 0, top_p: 0.1 },
	);

	const data = parseJsonArray<any>(response.message.content);

	return data.map((obj) => ({
		source: normalizeTagString(String(obj.source ?? "")),
		parts: Array.isArray(obj.parts)
			? obj.parts.map((p: any) => normalizeTagString(String(p)))
			: [],
		reason: String(obj.reason ?? ""),
	}));
}

async function runClassifierBatch(
	tags: string[],
	model = MODEL_NAME,
): Promise<ClassifiedTag[]> {
	if (!tags.length) return [];
	const payload = JSON.stringify({ tags }, null, 0);

	const response = await ollamaChat(
		model,
		[
			{ role: "system", content: CLASSIFIER_PROMPT },
			{ role: "user", content: payload },
		],
		OLLAMA_HOST,
		{ temperature: 0, top_p: 0.1 },
	);

	const data = parseJsonArray<any>(response.message.content);

	return data.map((obj) => ({
		source: normalizeTagString(String(obj.source ?? "")),
		class: String(obj.class ?? "other") as TagClass,
		reason: String(obj.reason ?? ""),
	}));
}

async function runDescriptorBatch(
	tags: string[],
	model = MODEL_NAME,
): Promise<DescriptorInfo[]> {
	if (!tags.length) return [];
	const payload = JSON.stringify({ tags }, null, 0);

	const response = await ollamaChat(
		model,
		[
			{ role: "system", content: DESCRIPTOR_PROMPT },
			{ role: "user", content: payload },
		],
		OLLAMA_HOST,
		{ temperature: 0, top_p: 0.1 },
	);

	const data = parseJsonArray<any>(response.message.content);

	return data.map((obj) => ({
		source: normalizeTagString(String(obj.source ?? "")),
		genre_like: obj.genre_like
			? normalizeTagString(String(obj.genre_like))
			: "",
		descriptors: Array.isArray(obj.descriptors)
			? obj.descriptors.map((d: any) => normalizeTagString(String(d)))
			: [],
		invalid_descriptors: Array.isArray(obj.invalid_descriptors)
			? obj.invalid_descriptors.map((d: any) =>
				normalizeTagString(String(d)),
			)
			: [],
		reason: String(obj.reason ?? ""),
	}));
}

async function runSubgenreBatch(
	tags: string[],
	model = MODEL_NAME,
): Promise<SubgenreInfo[]> {
	if (!tags.length) return [];
	const payload = JSON.stringify({ tags }, null, 0);

	const response = await ollamaChat(
		model,
		[
			{ role: "system", content: SUBGENRE_PROMPT },
			{ role: "user", content: payload },
		],
		OLLAMA_HOST,
		{ temperature: 0, top_p: 0.1 },
	);

	const data = parseJsonArray<any>(response.message.content);

	return data.map((obj) => ({
		source: normalizeTagString(String(obj.source ?? "")),
		is_subgenre: Boolean(obj.is_subgenre),
		parent_genre: obj.parent_genre
			? normalizeTagString(String(obj.parent_genre))
			: "",
		reason: String(obj.reason ?? ""),
	}));
}

// ============================================================
// TAG LOADING FROM SONG FILES
// ============================================================

function loadAllTagsFromSongs(): string[] {
	if (!fs.existsSync(SONGS_DIR)) {
		console.error(`❌ SONGS_DIR does not exist: ${SONGS_DIR}`);
		process.exit(1);
	}

	const files = fs
		.readdirSync(SONGS_DIR)
		.filter((f) => f.endsWith(".json") || f.endsWith(".json5"));

	const allTags: string[] = [];

	for (const file of files) {
		const fullPath = path.join(SONGS_DIR, file);
		try {
			const content = fs.readFileSync(fullPath, "utf8");
			const data = JSON.parse(content);

			// local tags
			if (Array.isArray(data.tags)) {
				for (const t of data.tags) {
					if (typeof t === "string" && t.trim().length > 0) {
						allTags.push(t);
					}
				}
			}

			// external sources
			for (const [src, field] of TAG_SOURCES) {
				const container = data[src];
				if (container && typeof container === "object") {
					const values = (container as any)[field];
					if (Array.isArray(values)) {
						for (const t of values) {
							if (typeof t === "string" && t.trim().length > 0) {
								allTags.push(t);
							}
						}
					}
				}
			}
		} catch (err) {
			console.warn(`⚠️ Could not parse tags from file: ${fullPath}`, err);
		}
	}

	return allTags;
}

function loadBlacklist(p: string = BLACKLIST_PATH): Set<string> {
	if (!fs.existsSync(p)) return new Set();

	let data: any;
	try {
		data = JSON.parse(fs.readFileSync(p, "utf8"));
	} catch {
		console.warn(`⚠ ${p} ist keine gültige JSON-Datei. Rückgabe: [].`);
		return new Set();
	}

	const tags = data?.blacklistedTags;
	if (!Array.isArray(tags)) {
		console.warn(
			`⚠ "blacklistedTags" in ${p} ist kein Array. Rückgabe: [].`,
		);
		return new Set();
	}

	const normalized = tags
		.filter((t: unknown) => typeof t === "string")
		.map((t: string) => normalizeTagString(t));

	return new Set(normalized);
}

const blacklist = loadBlacklist();

function filterBlacklistedTags(rawTags: string[]): {
	kept: string[];
	removed: string[];
} {
	const kept: string[] = [];
	const removed: string[] = [];

	for (const t of rawTags) {
		const norm = normalizeTagString(t);
		if (blacklist.has(norm)) {
			removed.push(norm);
		} else {
			kept.push(norm);
		}
	}

	return { kept, removed };
}

// TODO: needs implementing?
function applyBlacklistToFinalTags(tags: string[], blacklist: Set<string>): string[] {
	return tags.filter((t) => !blacklist.has(normalizeTagString(t)));
}

// ============================================================
// HIGH-LEVEL ORCHESTRATOR FOR ONE BATCH
// ============================================================

function decideHighLevelAction(
	canonical: CanonicalTag,
	split: SplitResult,
): string {
	if (split.parts.length > 1) return "split_genres";
	return canonical.action ?? "identity";
}

async function buildTagMapForBatch(
	rawTags: string[],
	modelName: string,
): Promise<TagMapEntry[]> {
	const now = new Date().toISOString();

	// 1) Canonicalization
	const canonicalResults = await runCanonicalizerBatch(rawTags, modelName);
	const canonicalBySource = new Map<string, CanonicalTag>();
	for (const c of canonicalResults) {
		canonicalBySource.set(c.source, c);
	}
	const canonicalStrings = canonicalResults.map((c) => c.canonical);

	// 2) Splitter
	const splitResults = await runSplitterBatch(canonicalStrings, modelName);
	const splitBySource = new Map<string, SplitResult>();
	for (const s of splitResults) {
		splitBySource.set(s.source, s);
	}

	// 3) Collect unique parts
	const allParts = splitResults.flatMap((s) => s.parts);
	const uniqueParts = Array.from(new Set(allParts));

	// 4) Classifier
	const classResults = await runClassifierBatch(uniqueParts, modelName);
	const classBySource = new Map<string, ClassifiedTag>();
	for (const c of classResults) {
		classBySource.set(c.source, c);
	}

	// 5) Descriptor extraction
	const descResults = await runDescriptorBatch(uniqueParts, modelName);
	const descBySource = new Map<string, DescriptorInfo>();
	for (const d of descResults) {
		descBySource.set(d.source, d);
	}

	// 6) Subgenre detection (only for genre/subgenre classes)
	const subgenreCandidates = uniqueParts.filter((p) => {
		const cls = classBySource.get(p)?.class;
		return cls === "genre" || cls === "subgenre";
	});
	const subgenreResults = await runSubgenreBatch(
		subgenreCandidates,
		modelName,
	);
	const subBySource = new Map<string, SubgenreInfo>();
	for (const s of subgenreResults) {
		subBySource.set(s.source, s);
	}

	// 7) Assemble TagMapEntry per raw tag
	const entries: TagMapEntry[] = [];

	for (const raw of rawTags) {
		const canonical = canonicalBySource.get(raw);
		// ================================================
		// Fallback: no canonical result for this raw tag
		// ================================================
		if (!canonical) {
			const fallbackCanonical: CanonicalTag = {
				source: raw,
				canonical: normalizeTagString(raw),
				action: "identity",
				reason: "No canonical mapping available; used raw tag as canonical.",
			};

			const fallbackSplit: SplitResult = {
				source: fallbackCanonical.canonical,
				parts: [fallbackCanonical.canonical],
				reason: "Not split (no canonical info).",
			};

			const entry: TagMapEntry = {
				source: raw,
				normalized_tags: [fallbackCanonical.canonical],
				tag_types: ["other"],
				canonical_stage: fallbackCanonical,
				split_stage: fallbackSplit,
				classification_stage: [],
				descriptor_stage: [],
				subgenre_stage: [],
				model: modelName,
				created_at: now,
			};

			entries.push(entry);
			continue;
		}

		// ================================================
		// Normal path: we have a canonical result
		// ================================================
		const split =
			splitBySource.get(canonical.canonical) ?? ({
				source: canonical.canonical,
				parts: [canonical.canonical],
				reason: "Not split by model.",
			} as SplitResult);

		const finalTags: string[] = [];
		const finalTypes: string[] = [];
		const reasons: string[] = [];

		// collect all strings relevant to this tag for per-stage info
		const relevantStrings = new Set<string>();

		for (const part of split.parts) {
			const partNorm = normalizeTagString(part);
			const cls = classBySource.get(partNorm);
			const desc = descBySource.get(partNorm);
			const sub = subBySource.get(partNorm);

			relevantStrings.add(partNorm);

			// 1) GENRE / SUBGENRE FROM SUB-STAGE (PRIMARY SOURCE)
			if (sub) {
				// use sub.source if available, otherwise the normalized part
				const base = normalizeTagString((sub as any).source ?? partNorm);

				if (base && !finalTags.includes(base)) {
					if (sub.is_subgenre) {
						// subgenre itself
						finalTags.push(base);
						finalTypes.push("subgenre");
						reasons.push(sub.reason ?? "Detected as subgenre by subgenre stage.");
						relevantStrings.add(base);

						// parent genre
						if (sub.parent_genre) {
							const parent = normalizeTagString(sub.parent_genre);
							if (parent && !finalTags.includes(parent)) {
								finalTags.push(parent);
								finalTypes.push("genre");
								reasons.push(sub.reason ?? "Parent genre from subgenre stage.");
								relevantStrings.add(parent);
							}
						}
					} else {
						// plain genre
						finalTags.push(base);
						finalTypes.push("genre");
						reasons.push(sub.reason ?? "Detected as genre by subgenre stage.");
						relevantStrings.add(base);
					}
				}
			}
			// 1b) FALLBACK: CLASSIFIER ONLY IF NO SUB-INFO
			else if (cls && (cls.class === "genre" || cls.class === "subgenre")) {
				if (!finalTags.includes(partNorm)) {
					finalTags.push(partNorm);
					finalTypes.push(cls.class === "subgenre" ? "subgenre" : "genre");
					reasons.push(cls.reason);
					relevantStrings.add(partNorm);
				}
			}

			// 2) valid descriptors
			if (desc) {
				for (const d of desc.descriptors) {
					const dNorm = normalizeTagString(d);
					finalTags.push(dNorm);
					const dCls = classBySource.get(dNorm);
					if (dCls?.class === "mood") {
						finalTypes.push("mood");
					} else {
						finalTypes.push("descriptor");
					}
					relevantStrings.add(dNorm);
				}
				// invalid_descriptors intentionally dropped
			}
		}

		// Fallback if nothing usable
		if (finalTags.length === 0) {
			const fallback = canonical.canonical || raw;
			finalTags.push(normalizeTagString(fallback));
			finalTypes.push("other");
			reasons.push("Used canonical form as fallback.");
			relevantStrings.add(normalizeTagString(fallback));
		}

		// Dedup tags
		const dedupTags = Array.from(new Set(finalTags));

		// Fix tag_types length
		const tagTypesFixed = [...finalTypes];
		while (tagTypesFixed.length < dedupTags.length) {
			tagTypesFixed.push("other");
		}
		if (tagTypesFixed.length > dedupTags.length) {
			tagTypesFixed.length = dedupTags.length;
		}

		// Per-stage subsets for this tag
		const classification_stage: ClassifiedTag[] = [];
		const descriptor_stage: DescriptorInfo[] = [];
		const subgenre_stage: SubgenreInfo[] = [];

		// Add classifier info for any relevant string we have
		for (const s of relevantStrings) {
			const cls = classBySource.get(s);
			if (cls) classification_stage.push(cls);
		}

		// Add descriptor info for any relevant string
		for (const s of relevantStrings) {
			const desc = descBySource.get(s);
			if (desc) descriptor_stage.push(desc);
		}

		// Add subgenre info for any relevant string
		for (const s of relevantStrings) {
			const sub = subBySource.get(s);
			if (sub) subgenre_stage.push(sub);
		}

		const entry: TagMapEntry = {
			source: raw,
			normalized_tags: dedupTags,
			tag_types: tagTypesFixed,
			canonical_stage: canonical,
			split_stage: split,
			classification_stage,
			descriptor_stage,
			subgenre_stage,
			model: modelName,
			created_at: now,
		};


		entries.push(entry);
	}

	return entries;
}

// ============================================================
// CLI PARSING
// ============================================================

interface CliOptions {
	limit: number | null;
}

function parseCliArgs(): CliOptions {
	const args = process.argv.slice(2);
	let limit: number | null = null;

	for (const arg of args) {
		if (arg === "--limit") {
			// default limit if flag is present without a value
			limit = 20;
		} else if (arg.startsWith("--limit=")) {
			const raw = arg.replace("--limit=", "").trim();
			const num = Number(raw);
			if (Number.isFinite(num) && num > 0) {
				limit = num;
			} else {
				console.warn(`⚠️ Invalid --limit value: ${raw}`);
			}
		} else if (arg === "-l") {
			limit = 20;
		}
	}

	return { limit };
}

// ============================================================
// MAIN
// ============================================================

async function main() {
	console.log("▶ Tag-Map – using model:", MODEL_NAME);

	console.log("▶ Loading tags from songs…");
	const allTagsRaw = loadAllTagsFromSongs();
	console.log(`   → Raw tags from songs: ${allTagsRaw.length}`);

	// Deduplicate by normalized string
	const uniqueSet = new Set<string>();
	for (const t of allTagsRaw) {
		if (typeof t === "string" && t.trim().length > 0) {
			uniqueSet.add(t);
		}
	}

	// Convert to array
	const uniqueRawTags = Array.from(uniqueSet);
	console.log(`   → Unique raw tags: ${uniqueRawTags.length}`);

	// ---------------------------------------------------------
	// 🆕 Stage 0: Blacklist filtering
	// ---------------------------------------------------------

	const { kept: tagsAfterBlacklist, removed: blacklisted } =
		filterBlacklistedTags(uniqueRawTags);

	console.log(`   → Blacklisted tags removed: ${blacklisted.length}`);
	console.log(`   → Tags entering Tag-Map pipeline: ${tagsAfterBlacklist.length}`);

	const cli = parseCliArgs();
	
	let uniqueTags: string[];

	if (cli.limit !== null) {
		console.log(`▶ CLI: limiting to first ${cli.limit} tags`);
		uniqueTags = tagsAfterBlacklist.slice(0, cli.limit);
		console.log(`   → Limited unique tags: ${uniqueTags.length}`);
	}
	else {
		uniqueTags = tagsAfterBlacklist;
	};

	// Load existing results for resumable behavior
	console.log("▶ Loading existing Tag-Map results…");
	const existing = loadJsonl(RESULTS_PATH) as TagMapEntry[];
	const processed = new Set<string>(
		existing
			.filter((e) => e && typeof e.source === "string")
			.map((e) => e.source),
	);
	console.log(`   → Already processed: ${processed.size}`);

	let todo = uniqueTags.filter((t) => !processed.has(t));
	console.log(`   → To process: ${todo.length}`);

	if (todo.length === 0) {
		console.log("✅ All tags already mapped.");
		return;
	}

	const numBatches = Math.ceil(todo.length / BATCH_SIZE);
	console.log(`▶ Processing in ${numBatches} batches (size ${BATCH_SIZE})…`);

	for (let i = 0; i < numBatches; i++) {
		const start = i * BATCH_SIZE;
		const end = Math.min(start + BATCH_SIZE, todo.length);
		const batch = todo.slice(start, end);

		console.log(`\n▶ Batch ${i + 1}/${numBatches}  (${batch.length} tags)`);
		console.log("   → Input tags:", batch);

		try {
			const results = await buildTagMapForBatch(batch, MODEL_NAME);
			appendJsonl(RESULTS_PATH, results);

			for (const r of results) {
				processed.add(r.source);
			}

			console.log(
				`   → Saved ${results.length} TagMap entries to ${RESULTS_PATH}`,
			);
		} catch (err) {
			console.error("❌ Error in batch:", err);
			console.error("   → Skipping this batch and continuing.");
		}
	}

	console.log("\n🎉 Done – Tag-Map results stored in:", RESULTS_PATH);
}

main().catch((err) => {
	console.error("❌ Unexpected error:", err);
	process.exit(1);
});
