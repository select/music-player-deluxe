#!/usr/bin/env tsx

import { readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";

interface MusicEntry {
	title: string;
	channel: string;
	ai?: {
		artist: string;
		track: string;
		tags: string[];
		tagsConfidence: number;
	};
}

interface OllamaResponse {
	message: {
		content: string;
	};
}

interface ExtractedMetadata {
	artist: string;
	track: string;
	tags: string[];
	tagsConfidence: number;
}

class OllamaClient {
	private baseUrl: string;

	constructor(host = "http://localhost:11434") {
		this.baseUrl = host;
	}

	async chat(
		model: string,
		messages: Array<{ role: string; content: string }>,
	): Promise<OllamaResponse> {
		const response = await fetch(`${this.baseUrl}/api/chat`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				model,
				messages,
				stream: false,
				format: "json",
			}),
		});

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		return await response.json();
	}

	async isModelAvailable(model: string): Promise<boolean> {
		try {
			const response = await fetch(`${this.baseUrl}/api/tags`);
			if (!response.ok) return false;

			const data = await response.json();
			return data.models?.some((m: any) => m.name.includes(model)) || false;
		} catch {
			return false;
		}
	}

	async pullModel(model: string): Promise<void> {
		console.log(`Pulling model ${model}...`);
		const response = await fetch(`${this.baseUrl}/api/pull`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ name: model }),
		});

		if (!response.ok) {
			throw new Error(`Failed to pull model: ${response.status}`);
		}

		// Stream the response to show progress
		const reader = response.body?.getReader();
		if (reader) {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				const chunk = new TextDecoder().decode(value);
				const lines = chunk.split("\n").filter((line) => line.trim());

				for (const line of lines) {
					try {
						const progress = JSON.parse(line);
						if (progress.status) {
							process.stdout.write(`\r${progress.status}`);
							if (progress.completed && progress.total) {
								const percent = Math.round(
									(progress.completed / progress.total) * 100,
								);
								process.stdout.write(` ${percent}%`);
							}
						}
					} catch {
						// Ignore malformed JSON lines
					}
				}
			}
		}
		console.log("\nModel pull completed.");
	}
}

class JsonAugmenter {
	private ollama: OllamaClient;
	private model: string;

	constructor(model = "gemma2:2b", host?: string) {
		this.ollama = new OllamaClient(host);
		this.model = model;
	}

	private createPrompt(title: string, channel: string): string {
		return `You are a music metadata extraction expert. Given a YouTube video title and channel name, extract the artist name, track name, and relevant music genre tags.

Title: "${title}"
Channel: "${channel}"

Please analyze this information and extract:
1. Artist name (the main performing artist)
2. Track name (the song title, cleaned up)
3. Genre tags (2-4 relevant music genre/style tags)
4. Your confidence in the genre tags (value between 0 and 1)

Guidelines:
- Remove common YouTube suffixes like "(Official Video)", "(Lyric Video)", "[HD]", etc.
- If the artist is not clear from the title, use the channel name as a fallback
- For genre tags, use lowercase, common music genres (e.g., "rock", "pop", "jazz", "electronic", "hip hop", "classical", "folk", "metal", "country", "blues", "reggae", "punk", "indie", "alternative", "dance", "ambient", "experimental")
- Be concise and accurate

Respond in valid JSON format only:
{
  "artist": "extracted artist name",
  "track": "extracted track name",
  "tags": ["genre1", "genre2", "genre3"]
  "tagsConfidence": 0.6
}`;
	}

	private async extractMetadata(
		title: string,
		channel: string,
	): Promise<ExtractedMetadata | null> {
		try {
			const prompt = this.createPrompt(title, channel);
			const response = await this.ollama.chat(this.model, [
				{ role: "user", content: prompt },
			]);

			const content = response.message.content.trim();

			// Try to extract JSON from the response
			let jsonMatch = content.match(/\{[\s\S]*\}/);
			if (!jsonMatch) {
				console.warn(`No JSON found in response for "${title}"`);
				return null;
			}

			const extracted = JSON.parse(jsonMatch[0]) as ExtractedMetadata;

			// Validate the extracted data
			if (
				!extracted.artist ||
				!extracted.track ||
				!Array.isArray(extracted.tags) ||
				typeof extracted.tagsConfidence !== "number"
			) {
				console.warn(`Invalid metadata structure for "${title}"`);
				return null;
			}

			return {
				artist: extracted.artist.trim(),
				track: extracted.track.trim(),
				tags: extracted.tags.filter(
					(tag) => typeof tag === "string" && tag.trim().length > 0,
				),
				tagsConfidence: Math.max(0, Math.min(1, extracted.tagsConfidence)),
			};
		} catch (error) {
			console.error(`Error extracting metadata for "${title}":`, error);
			return null;
		}
	}

	async augmentJsonFile(
		inputPath: string,
		outputPath: string,
		batchSize = 5,
	): Promise<void> {
		if (!existsSync(inputPath)) {
			throw new Error(`Input file does not exist: ${inputPath}`);
		}

		console.log(`Reading ${inputPath}...`);
		const fileContent = await readFile(inputPath, "utf-8");
		const entries: MusicEntry[] = JSON.parse(fileContent);

		console.log(`Found ${entries.length} entries to process`);

		// Check if output file exists for resuming
		let augmentedEntries: MusicEntry[] = [...entries];
		if (existsSync(outputPath)) {
			console.log(`📄 Found existing output file: ${outputPath}`);
			console.log(`🔄 Resuming from previous progress...`);
			try {
				const existingContent = await readFile(outputPath, "utf-8");
				const existingEntries: MusicEntry[] = JSON.parse(existingContent);

				// Merge existing AI metadata back into the current entries
				for (
					let i = 0;
					i < Math.min(entries.length, existingEntries.length);
					i++
				) {
					if (
						existingEntries[i].ai &&
						entries[i].title === existingEntries[i].title
					) {
						augmentedEntries[i].ai = existingEntries[i].ai;
					}
				}

				const resumedCount = augmentedEntries.filter(
					(entry) => entry.ai,
				).length;
				console.log(
					`✅ Resumed with ${resumedCount} entries already processed`,
				);
			} catch (error) {
				console.warn(
					`⚠️ Could not read existing output file, starting fresh:`,
					error,
				);
			}
		}

		// Check if model is available
		if (!(await this.ollama.isModelAvailable(this.model))) {
			console.log(
				`Model ${this.model} not found locally. Attempting to pull...`,
			);
			await this.ollama.pullModel(this.model);
		}

		// Filter entries that don't already have AI metadata
		const entriesToProcess = augmentedEntries.filter((entry) => !entry.ai);
		console.log(
			`Processing ${entriesToProcess.length} entries without AI metadata`,
		);

		let processedCount = 0;

		// Process in batches to avoid overwhelming the API
		for (let i = 0; i < entriesToProcess.length; i += batchSize) {
			const batch = entriesToProcess.slice(i, i + batchSize);
			const batchNumber = Math.floor(i / batchSize) + 1;
			const totalBatches = Math.ceil(entriesToProcess.length / batchSize);
			console.log(`\nProcessing batch ${batchNumber}/${totalBatches}`);

			const batchPromises = batch.map(async (entry) => {
				const metadata = await this.extractMetadata(entry.title, entry.channel);
				if (metadata) {
					// Find the entry in the augmented array and update it
					const index = augmentedEntries.findIndex(
						(e) => e.title === entry.title && e.channel === entry.channel,
					);
					if (index !== -1) {
						augmentedEntries[index] = {
							...augmentedEntries[index],
							ai: metadata,
						};
					}
				}
				processedCount++;
				console.log(
					`Processed ${processedCount}/${entriesToProcess.length}: "${entry.title}"`,
				);
				return metadata;
			});

			await Promise.all(batchPromises);

			// Save progress after each batch
			console.log(
				`💾 Saving progress after batch ${batchNumber}/${totalBatches}...`,
			);
			await writeFile(
				outputPath,
				JSON.stringify(augmentedEntries, null, 2),
				"utf-8",
			);
			const currentAugmentedCount = augmentedEntries.filter(
				(entry) => entry.ai,
			).length;
			const progressPercent = Math.round(
				(currentAugmentedCount / entries.length) * 100,
			);
			console.log(
				`✅ Progress saved! ${currentAugmentedCount}/${entries.length} entries (${progressPercent}%) now have AI metadata`,
			);

			// Add a small delay between batches to be respectful to the API
			if (i + batchSize < entriesToProcess.length) {
				console.log("Waiting 2 seconds before next batch...");
				await new Promise((resolve) => setTimeout(resolve, 2000));
			}
		}

		console.log(`\nWriting augmented data to ${outputPath}...`);
		await writeFile(
			outputPath,
			JSON.stringify(augmentedEntries, null, 2),
			"utf-8",
		);

		const augmentedCount = augmentedEntries.filter((entry) => entry.ai).length;
		console.log(
			`✅ Augmentation complete! ${augmentedCount}/${entries.length} entries have AI metadata`,
		);
	}
}

async function main() {
	const args = process.argv.slice(2);

	if (args.length < 1) {
		console.log(`
Usage: tsx augment-json-with-ollama.ts <input-file> [output-file] [options]

Arguments:
  input-file   Path to the input JSON file
  output-file  Path to the output JSON file (optional, defaults to input-file with .augmented.json suffix)

Options:
  --model      Ollama model to use (default: gemma2:2b)
  --host       Ollama host URL (default: http://localhost:11434)
  --batch-size Number of entries to process concurrently (default: 5)

Examples:
  tsx augment-json-with-ollama.ts data/extracted-missing-metadata.json
  tsx augment-json-with-ollama.ts data/music.json data/music-augmented.json --model gemma2:9b
  tsx augment-json-with-ollama.ts data/input.json --host http://192.168.1.100:11434
`);
		process.exit(1);
	}

	const inputFile = args[0];
	let outputFile = args[1];
	let model = "gemma3:4b";
	let host = "http://localhost:11434";
	let batchSize = 2;

	// Parse additional arguments
	for (let i = 0; i < args.length; i++) {
		if (args[i] === "--model" && args[i + 1]) {
			model = args[i + 1];
			i++;
		} else if (args[i] === "--host" && args[i + 1]) {
			host = args[i + 1];
			i++;
		} else if (args[i] === "--batch-size" && args[i + 1]) {
			batchSize = parseInt(args[i + 1], 10) || 5;
			i++;
		}
	}

	// Default output file if not provided
	if (!outputFile) {
		const inputBasename = inputFile.replace(/\.json$/, "");
		outputFile = `${inputBasename}.augmented.json`;
	}

	console.log(`🎵 Music JSON Augmenter with Ollama`);
	console.log(`Input file: ${inputFile}`);
	console.log(`Output file: ${outputFile}`);
	console.log(`Model: ${model}`);
	console.log(`Host: ${host}`);
	console.log(`Batch size: ${batchSize}`);

	try {
		const augmenter = new JsonAugmenter(model, host);
		await augmenter.augmentJsonFile(inputFile, outputFile, batchSize);
	} catch (error) {
		console.error("❌ Error:", error);
		process.exit(1);
	}
}

// Check if this script is being run directly
if (import.meta.url === `file://${process.argv[1]}`) {
	main().catch(console.error);
}

export { JsonAugmenter, OllamaClient };
