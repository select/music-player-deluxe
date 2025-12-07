#!/usr/bin/env node

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

const MODEL_NAME = "gemma3:4b"; // oder "qwen2.5:7b", "mistral:7b", ...
const RESULTS_PATH = path.join(__dirname, "../data/tag-blacklist-model-results.jsonl");
const BLACKLIST_PATH = path.join(
	__dirname,
	"../server/assets/tag-blacklist.json",
);
const PROMPT_PATH = path.join(
	__dirname,
	"../prompts/tag-blacklist-prompt-v2.txt",
);
const SONGS_DIR = path.join(__dirname, "../server/assets/songs");
const BATCH_SIZE = 20;

interface OllamaConfig {
	host: string;
	model: string;
}

const DEFAULT_CONFIG: OllamaConfig = {
	host: "http://localhost:11434",
	model: MODEL_NAME,
};

interface OllamaChatMessage {
	role: "system" | "user" | "assistant";
	content: string;
}

interface OllamaChatResponse {
	message: {
		content: string;
	};
	// weitere Felder ignoriert
}

interface TagClassificationResult {
	tag: string;
	decision: "whitelist" | "blacklist" | string;
	score?: number;
	reason?: string;
	[key: string]: unknown;
}

// ============================================================
// PROMPT LOADING
// ============================================================

function loadPrompt(): string {
	try {
		return fs.readFileSync(PROMPT_PATH, "utf8");
	} catch (error) {
		console.error(
			"Error loading tag classifier prompt:",
			(error as Error).message,
		);
		process.exit(1);
	}
}

const SYSTEM_PROMPT = loadPrompt();

// ============================================================
// OLLAMA HELPERS
// ============================================================

async function isOllamaModelAvailable(
	model: string,
	host = DEFAULT_CONFIG.host,
): Promise<boolean> {
	try {
		const response = await fetch(`${host}/api/tags`);
		if (!response.ok) return false;
		const data = (await response.json()) as any;
		return (
			Array.isArray(data.models) &&
			data.models.some((m: any) => typeof m.name === "string" && m.name.includes(model))
		);
	} catch {
		return false;
	}
}

async function ollamaChat(
	model: string,
	messages: OllamaChatMessage[],
	host = DEFAULT_CONFIG.host,
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
		throw new Error(`HTTP error from Ollama: ${response.status}`);
	}

	return (await response.json()) as OllamaChatResponse;
}

// ============================================================
// SONG LOADING
// ============================================================

type AnyRecord = Record<string, any>;

function getAllJsonFiles(dir: string): string[] {
	const entries = fs.readdirSync(dir, { withFileTypes: true });
	const files: string[] = [];

	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			files.push(...getAllJsonFiles(fullPath));
		} else if (entry.isFile() && entry.name.toLowerCase().endsWith(".json")) {
			files.push(fullPath);
		}
	}

	return files;
}

function loadSongs(songsDir: string = SONGS_DIR): AnyRecord[] {
	const jsonPaths = getAllJsonFiles(songsDir).sort();
	const records: AnyRecord[] = [];

	for (const p of jsonPaths) {
		let data: unknown;
		try {
			const raw = fs.readFileSync(p, "utf8");
			data = JSON.parse(raw);
		} catch (error) {
			console.warn(`⚠ Skipping ${p}:`, (error as Error).message);
			continue;
		}

		if (data && typeof data === "object" && !Array.isArray(data)) {
			const rec: AnyRecord = { ...(data as AnyRecord), _file_path: p };
			records.push(rec);
		} else if (Array.isArray(data)) {
			for (const item of data) {
				if (item && typeof item === "object" && !Array.isArray(item)) {
					const it: AnyRecord = { ...(item as AnyRecord), _file_path: p };
					records.push(it);
				} else {
					records.push({ _value: item, _file_path: p });
				}
			}
		} else {
			records.push({ _value: data, _file_path: p });
		}
	}

	console.log(
		`Loaded ${records.length} records from ${jsonPaths.length} JSON files.`,
	);
	return records;
}

// ============================================================
// TAG EXTRACTION
// ============================================================

function normalizeTagString(tag: string): string {
	return tag
		.normalize("NFKC")     // Unicode normalisieren (optional, aber sinnvoll)
		.trim()                // Leading/Trailing Spaces weg
		.replace(/\s+/g, " ")  // Mehrfachspaces → genau ein Space
		.toLowerCase();        // Case-insensitive machen
}


function normalizeTags(value: unknown): Set<string> {
	const result = new Set<string>();

	if (value == null) return result;

	// -------------------------
	// 1) Einzelner String
	// -------------------------
	if (typeof value === "string") {
		result.add(normalizeTagString(value));
		return result;
	}

	// -------------------------
	// 2) Iterable (Array, Set)
	// -------------------------
	if (Array.isArray(value) || value instanceof Set) {
		for (const item of value as any[]) {
			if (typeof item === "string") {
				result.add(normalizeTagString(item));
			} else if (item && typeof item === "object" && !Array.isArray(item)) {
				const name = (item as AnyRecord).name;
				if (typeof name === "string") {
					result.add(normalizeTagString(name));
				}
			}
		}
		return result;
	}

	return result;
}

function extractAllTags(records: AnyRecord[]): Set<string> {
	const allTags = new Set<string>();

	const tagSources: Array<[string, string]> = [
		["lastfm", "tags"],
		["musicbrainz", "artistTags"],
		["musicbrainz", "artistGenres"],
		["musicbrainz", "genres"],
	];

	for (const record of records) {
		for (const [parentKey, childKey] of tagSources) {
			const parent = record[parentKey];
			if (!parent || typeof parent !== "object" || Array.isArray(parent)) {
				continue;
			}
			const value = (parent as AnyRecord)[childKey];
			const normalized = normalizeTags(value);
			for (const t of normalized) {
				allTags.add(t);
			}
		}
	}

	return allTags;
}

// ============================================================
// JSON CLEANING
// ============================================================

function cleanModelOutput(raw: string): string {
	let trimmed = raw.trim();

	// ``` fences entfernen
	if (trimmed.startsWith("```")) {
		const parts = trimmed.split("\n");
		parts.shift(); // erste ```...-Zeile weg
		trimmed = parts.join("\n");
		if (trimmed.includes("```")) {
			trimmed = trimmed.substring(0, trimmed.lastIndexOf("```"));
		}
		trimmed = trimmed.trim();
	}

	// Nur den JSON-Array-Teil extrahieren
	const start = trimmed.indexOf("[");
	const end = trimmed.lastIndexOf("]");
	if (start !== -1 && end !== -1 && end > start) {
		trimmed = trimmed.slice(start, end + 1);
	}

	return trimmed.trim();
}

// ============================================================
// JSONL HELPERS
// ============================================================

function loadJsonl(p: string): AnyRecord[] {
	if (!fs.existsSync(p)) return [];

	const results: AnyRecord[] = [];
	const lines = fs.readFileSync(p, "utf8").split(/\r?\n/);

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed || !trimmed.startsWith("{")) continue;
		try {
			results.push(JSON.parse(trimmed));
		} catch {
			console.warn("⚠ Skipping invalid JSON line in JSONL file:", trimmed);
		}
	}
	return results;
}

function appendResults(results: AnyRecord[], p: string = RESULTS_PATH): void {
	const fd = fs.openSync(p, "a");
	try {
		for (const entry of results) {
			const line = JSON.stringify(entry, null, 0);
			fs.writeSync(fd, line + "\n");
		}
	} finally {
		fs.closeSync(fd);
	}
}

function normalizeResultTags(results: TagClassificationResult[]): TagClassificationResult[] {
	return results.map((r) => ({
		...r,
		tag: normalizeTagString(String(r.tag ?? "")),
	}));
}

// ============================================================
// BLACKLIST HELPERS
// ============================================================

function loadBlacklist(p: string = BLACKLIST_PATH): string[] {
	if (!fs.existsSync(p)) return [];

	let data: any;
	try {
		data = JSON.parse(fs.readFileSync(p, "utf8"));
	} catch {
		console.warn(`⚠ ${p} ist keine gültige JSON-Datei. Rückgabe: [].`);
		return [];
	}

	const tags = data?.blacklistedTags;
	if (!Array.isArray(tags)) {
		console.warn(
			`⚠ "blacklistedTags" in ${p} ist kein Array. Rückgabe: [].`,
		);
		return [];
	}

	return tags
		.filter((t: unknown) => typeof t === "string")
		.map((t: string) => normalizeTagString(t));
}

function updateBlacklistFromResults(
	batchResults: TagClassificationResult[],
	blacklistPath: string = BLACKLIST_PATH,
	modelName: string = MODEL_NAME,
	promptVersion: string = PROMPT_PATH
): number {
	const currentTags = new Set(loadBlacklist(blacklistPath));

	const newlyBlacklisted: string[] = [];
	for (const r of batchResults) {
		const decision = String(r.decision || "").toLowerCase();
		const rawTag = String(r.tag ?? "");
		const tag = normalizeTagString(rawTag);
		if (!tag) continue;

		if (decision === "blacklist" && !currentTags.has(tag)) {
			currentTags.add(tag);
			newlyBlacklisted.push(tag);
		}
	}

	if (newlyBlacklisted.length === 0) return 0;

	const finalList = Array.from(currentTags).sort((a, b) =>
		a.localeCompare(b, undefined, { sensitivity: "base" }),
	);

	const obj = {
		blacklistedTags: finalList,
		lastUpdated: new Date().toISOString(),
		model: modelName,
		prompt: promptVersion
	};

	fs.writeFileSync(blacklistPath, JSON.stringify(obj, null, 2), "utf8");
	console.log(
		`📝 blacklist-v2.json aktualisiert: +${newlyBlacklisted.length} neue Tags`,
	);

	return newlyBlacklisted.length;
}

// ============================================================
// MODEL CALL
// ============================================================

async function callModelForBatch(
	tagBatch: string[],
	config: Partial<OllamaConfig> = {},
): Promise<TagClassificationResult[]> {
	const { host, model } = { ...DEFAULT_CONFIG, ...config };

	const payload = JSON.stringify({ tags: tagBatch }, null, 0);

	const response = await ollamaChat(
		model,
		[
			{ role: "system", content: SYSTEM_PROMPT },
			{ role: "user", content: payload },
		],
		host,
		{ temperature: 0 },
	);

	const rawContent = response.message.content;
	const cleaned = cleanModelOutput(rawContent);

	let data: unknown;
	
	try {
		data = JSON.parse(cleaned);
	} catch {
		console.error("\n❌ Model returned invalid JSON:\n", rawContent);
		throw new Error("Model output is not valid JSON");
	}

	if (!Array.isArray(data)) {
		throw new Error(
			`Expected a JSON array from model, got: ${typeof data}`,
		);
	}

	// Leichtes Typ-Cast, wir verlassen uns auf Prompt-Disziplin
	return data as TagClassificationResult[];
}

// ============================================================
// MAIN CLASSIFIER (RESUMABLE)
// ============================================================

async function classifyTagsResumable(
	allTags: Iterable<string>,
): Promise<boolean> {
	const uniqueTags = Array.from(new Set(allTags)).sort((a, b) =>
		a.localeCompare(b, undefined, { sensitivity: "base" }),
	);

	const jsonLines = loadJsonl(RESULTS_PATH);
	const processed = new Set<string>(
		jsonLines
			.filter((line) => typeof line.tag === "string")
			.map((line) => String(line.tag)),
	);

	const currentBlacklist = new Set(loadBlacklist());
	for (const t of currentBlacklist) {
		processed.add(normalizeTagString(t));
	}

	const todo = uniqueTags.filter((t) => !processed.has(t));

	console.log(`Total unique tags: ${uniqueTags.length}`);
	console.log(
		`Already processed (cache + blacklist): ${processed.size}`,
	);
	console.log(`Remaining to classify: ${todo.length}`);

	if (todo.length === 0) {
		console.log("✔ All tags already classified. Nothing to do.");
		return false;
	}

	const numBatches = Math.ceil(todo.length / BATCH_SIZE);
	let anyNew = false;

	for (let i = 0; i < numBatches; i++) {
		const start = i * BATCH_SIZE;
		const end = start + BATCH_SIZE;
		const batch = todo.slice(start, end);

		console.log(`\n▶ Batch ${i + 1}/${numBatches}  (${batch.length} tags)`);

		const rawResults = await callModelForBatch(batch);
		const results = normalizeResultTags(rawResults);
		
		appendResults(results);
		for (const r of results) {
			if (r.tag) processed.add(String(r.tag));
		}

		const added = updateBlacklistFromResults(results);
		if (added > 0) {
			anyNew = true;
		}
	}

	console.log("\n🎉 Finished — all new results cached in", RESULTS_PATH);
	return anyNew;
}

// ============================================================
// MAIN
// ============================================================

async function main(): Promise<void> {
	console.log("Starting augment-blacklist script...");
	console.log("Loading songs and extracting tags...");

	const modelAvailable = await isOllamaModelAvailable(DEFAULT_CONFIG.model);
	if (!modelAvailable) {
		console.error(
			`Ollama model ${DEFAULT_CONFIG.model} is not available. Please ensure Ollama is running and the model is installed.`,
		);
		process.exit(1);
	}

	const records = loadSongs();
	const tags = extractAllTags(records);
	console.log(`Found ${tags.size} unique tags.`);

	const changed = await classifyTagsResumable(tags);
	if (changed) {
		console.log(
			"\n✅ Tag classification complete. Blacklist and cache have been updated.",
		);
	} else {
		console.log("\nℹ️ Nothing new to classify.");
	}
}

// Graceful shutdown
process.on("SIGINT", () => {
	console.log("\n\nReceived SIGINT. Gracefully shutting down...");
	process.exit(0);
});

process.on("SIGTERM", () => {
	console.log("\n\nReceived SIGTERM. Gracefully shutting down...");
	process.exit(0);
});

// Run
main().catch((error) => {
	console.error("Script error:", error);
	process.exit(1);
});
