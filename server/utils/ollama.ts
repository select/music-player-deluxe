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

interface OllamaConfig {
	host: string;
	model: string;
}

const DEFAULT_CONFIG: OllamaConfig = {
	host: "http://localhost:11434",
	model: "gemma3:4b",
};

async function makeOllamaRequest(
	url: string,
	body: Record<string, any>,
): Promise<Response> {
	return await fetch(url, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify(body),
	});
}

export async function ollamaChat(
	model: string,
	messages: Array<{ role: string; content: string }>,
	host = DEFAULT_CONFIG.host,
): Promise<OllamaResponse> {
	const response = await makeOllamaRequest(`${host}/api/chat`, {
		model,
		messages,
		stream: false,
		format: "json",
	});

	if (!response.ok) {
		throw new Error(`HTTP error! status: ${response.status}`);
	}

	return await response.json();
}

export async function isOllamaModelAvailable(
	model: string,
	host = DEFAULT_CONFIG.host,
): Promise<boolean> {
	try {
		const response = await fetch(`${host}/api/tags`);
		if (!response.ok) return false;

		const data = await response.json();
		return data.models?.some((m: any) => m.name.includes(model)) ?? false;
	} catch {
		return false;
	}
}

function createMetadataPrompt(title: string, channel: string): string {
	return `You are a music metadata extraction expert. Given a YouTube video title and channel name, extract the artist name, track name.

Title: "${title}"
Channel: "${channel}"

Please analyze this information and extract:
1. Artist name (the main performing artist)
2. Track name (the song title, cleaned up)

Guidelines:
- Remove common YouTube suffixes like "(Official Video)", "(Lyric Video)", "[HD]", etc.
- If the artist is not clear from the title, use the channel name as a fallback
- Be concise and accurate

Respond in valid JSON format only:
{
  "artist": "extracted artist name",
  "track": "extracted track name",
}`;
}

function extractJsonFromResponse(content: string): string | null {
	const jsonMatch = content.match(/\{[\s\S]*\}/);
	return jsonMatch?.[0] ?? null;
}

function validateExtractedMetadata(
	extracted: any,
): extracted is ExtractedMetadata {
	return extracted?.artist && extracted?.track;
}

function parseMetadataResponse(
	content: string,
	title: string,
): ExtractedMetadata | null {
	const jsonString = extractJsonFromResponse(content.trim());
	if (!jsonString) {
		console.warn(`No JSON found in response for "${title}"`);
		return null;
	}

	try {
		const extracted = JSON.parse(jsonString);

		if (!validateExtractedMetadata(extracted)) {
			console.warn(`Invalid metadata structure for "${title}"`);
			return null;
		}

		return extracted;
	} catch (error) {
		console.error(`Error parsing JSON for "${title}":`, error);
		return null;
	}
}

export async function extractMetadataWithOllama(
	youtubeId: string,
	title: string,
	channel: string,
	config: Partial<OllamaConfig> = {},
): Promise<{ title: string; artist: string } | null> {
	const { host, model } = { ...DEFAULT_CONFIG, ...config };

	try {
		// Check if model is available
		const modelAvailable = await isOllamaModelAvailable(model, host);
		if (!modelAvailable) {
			console.warn(`Model ${model} not available`);
			return null;
		}

		const prompt = createMetadataPrompt(title, channel);
		const response = await ollamaChat(
			model,
			[{ role: "user", content: prompt }],
			host,
		);

		const extracted = parseMetadataResponse(response.message.content, title);
		if (!extracted) {
			return null;
		}

		return {
			artist: extracted.artist.trim(),
			title: extracted.track.trim(),
		};
	} catch (error) {
		console.error(`Error extracting metadata for "${title}":`, error);
		return null;
	}
}
