export interface ParsedTitle {
	artist: string;
	title: string;
	confidence: number; // 0-1, how confident we are in the parsing
}

/**
 * Clean up dangling separators and extra whitespace from strings
 */
function cleanDanglingSeparators(text: string): string {
	return (
		text
			// Remove remix/version indicators
			.replace(
				/\s*\((Original\s+Mix|Radio\s+Edit|Extended\s+Mix|Club\s+Mix|Remix|Remaster|Remastered|Version)\)\s*/gi,
				"",
			)
			// Remove dangling separators at the end
			.replace(/\s*[-–~|:]\s*$/, "")
			// Remove dangling separators at the beginning
			.replace(/^\s*[-–~|:]\s*/, "")
			// Remove dangling parentheses and brackets
			.replace(/\s*[()\[\]{}]\s*$/, "")
			.replace(/^\s*[()\[\]{}]\s*/, "")
			// Remove dangling punctuation at the end
			.replace(/\s*[,;.!?]\s*$/, "")
			// Remove multiple consecutive separators
			.replace(/\s*[-–~|:]\s*[-–~|:]\s*/g, " - ")
			// Clean up extra whitespace
			.replace(/\s+/g, " ")
			.trim()
	);
}

/**
 * Parse artist and title from video title using various patterns
 */
export function parseArtistAndTitle(title: string): ParsedTitle[] {
	const results: ParsedTitle[] = [];

	// First, clean the title of common markers
	const cleanedTitle = cleanVideoTitleForParsing(title);

	// Pattern 1: "Artist - Title" or "Artist – Title" (em dash)
	// Handle cases like "Artist - Title - Extra" by taking only first two parts
	let match = cleanedTitle.match(/^(.+?)\s*[-–]\s*([^-–]+?)(?:\s*[-–].*)?$/);
	if (match && match[1] && match[2]) {
		const [, artist, songTitle] = match;
		results.push({
			artist: cleanDanglingSeparators(artist),
			title: cleanDanglingSeparators(songTitle),
			confidence: 0.9,
		});
	}

	// Pattern 2: "Artist ~ Title" (tilde separator)
	match = cleanedTitle.match(/^(.+?)\s*~\s*(.+?)(?:\s*~.*)?$/);
	if (match && match[1] && match[2]) {
		const [, artist, songTitle] = match;
		results.push({
			artist: cleanDanglingSeparators(artist),
			title: cleanDanglingSeparators(songTitle),
			confidence: 0.85,
		});
	}

	// Pattern 3: "Title - Artist" (reverse pattern, common with live recordings)
	// Look for patterns like "Song Title - Artist Name" where artist is shorter and at the end
	match = cleanedTitle.match(/^([^-]+?)\s*-\s*([^-]+?)(?:\s*-.*)?$/);
	if (match && match[1] && match[2]) {
		const [, possibleTitle, possibleArtist] = match;

		// Improved heuristics for reverse detection
		const songKeywords = [
			"live",
			"version",
			"remix",
			"cover",
			"acoustic",
			"instrumental",
			"edit",
			"remaster",
			"demo",
			"alternate",
			"extended",
			"radio",
			"single",
		];
		const artistIndicators = [
			"feat",
			"ft",
			"featuring",
			"vs",
			"x",
			"with",
			"and",
			"&",
		];

		// Check if first part has song-specific keywords (indicating it's likely a title)
		const titleHasSongKeyword = songKeywords.some((keyword) =>
			possibleTitle.toLowerCase().includes(keyword),
		);

		// Check if second part has artist collaboration indicators
		const artistHasIndicator = artistIndicators.some((indicator) =>
			possibleArtist.toLowerCase().includes(indicator),
		);

		// Check if second part looks like a single artist name (short, capitalized words)
		const artistLooksLikeArtist =
			possibleArtist.length < 25 && // Reasonable artist name length
			possibleArtist.split(" ").length <= 3 && // Not too many words
			!/[()[\]]/.test(possibleArtist); // No brackets (likely extra info)

		// Reverse detection logic
		const shouldReverse =
			titleHasSongKeyword || // First part has song keywords
			(artistLooksLikeArtist &&
				!artistHasIndicator &&
				possibleArtist.length < possibleTitle.length * 0.7); // Artist is notably shorter

		if (shouldReverse) {
			results.push({
				artist: cleanDanglingSeparators(possibleArtist),
				title: cleanDanglingSeparators(possibleTitle),
				confidence: 0.75,
			});
		}
	}

	// Pattern 4: "Artist: Title" (colon separator)
	match = cleanedTitle.match(/^(.+?)\s*:\s*(.+)$/);
	if (match && match[1] && match[2]) {
		const [, artist, songTitle] = match;
		results.push({
			artist: cleanDanglingSeparators(artist),
			title: cleanDanglingSeparators(songTitle),
			confidence: 0.8,
		});
	}

	// Pattern 5: "Artist | Title" (pipe separator)
	// Handle extra content after pipe
	match = cleanedTitle.match(/^(.+?)\s*\|\s*([^|]+?)(?:\s*\|.*)?$/);
	if (match && match[1] && match[2]) {
		const [, artist, songTitle] = match;
		results.push({
			artist: cleanDanglingSeparators(artist),
			title: cleanDanglingSeparators(songTitle),
			confidence: 0.8,
		});
	}

	// Pattern 6: Look for quoted titles: Artist "Title"
	match = cleanedTitle.match(/^(.+?)\s*["'"](.+?)["'"].*$/);
	if (match && match[1] && match[2]) {
		const [, artist, songTitle] = match;
		results.push({
			artist: cleanDanglingSeparators(artist),
			title: cleanDanglingSeparators(songTitle),
			confidence: 0.85,
		});
	}

	// Pattern 7: Artist followed by all caps title
	match = cleanedTitle.match(/^(.+?)\s+([A-Z\s]{3,})(?:\s|$)/);
	if (match && match[1] && match[2]) {
		const [, artist, songTitle] = match;
		if (songTitle.trim().split(" ").length <= 5) {
			// Reasonable song title length
			results.push({
				artist: cleanDanglingSeparators(artist),
				title: cleanDanglingSeparators(songTitle),
				confidence: 0.7,
			});
		}
	}

	// If no patterns matched, create a fallback result with the cleaned title
	if (results.length === 0) {
		results.push({
			artist: "Unknown Artist",
			title: cleanDanglingSeparators(cleanedTitle || title),
			confidence: 0.1, // Very low confidence since it's a fallback
		});
	}

	return results.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Clean video title for parsing (less aggressive than the general cleaning)
 */
export function cleanVideoTitleForParsing(title: string): string {
	return (
		title
			// Remove specific patterns first
			.replace(/\s*\[Official Music Video\]/gi, "")
			.replace(/\s*\[4K Remaster\]/gi, "")
			// Remove common video markers but keep structure
			.replace(
				/\s*\[(Official|Music|Video|Audio|Lyric|Live|HD|4K|HQ|MV)\s?(Video|Audio|Music|Performance|MV)?\]/gi,
				"",
			)
			.replace(
				/\s*\((Official|Music|Video|Audio|Lyric|Live|HD|4K|HQ|MV)\s?(Video|Audio|Music|Performance|MV)?\)/gi,
				"",
			)
			// Remove year markers in parentheses like (1968), (2021) or slashes like /1990/
			.replace(/\s*\(\d{4}\)/g, "")
			.replace(/\s*\/\d{4}\/\s*/g, "")
			// Remove remaster and audio format markers
			.replace(
				/\s*\((Stereo|Mono|Remastered?|Remaster|\d{4}\s*Remaster(ed)?)\)/gi,
				"",
			)
			.replace(
				/\s*\[(Stereo|Mono|Remastered?|Remaster|\d{4}\s*Remaster(ed)?)\]/gi,
				"",
			)
			// Remove quality markers
			.replace(/\s*\b(HD|4K|1080p|720p|HQ|High Quality)\b/gi, "")
			// Remove featuring but be more careful about it
			.replace(/\s*[fF]t\.?\s+[^-~|:]+?(?=\s*[-~|:]|$)/g, "")
			.replace(/\s*[Ff]eat\.?\s+[^-~|:]+?(?=\s*[-~|:]|$)/g, "")
			.replace(/\s*[Ff]eaturing\.?\s+[^-~|:]+?(?=\s*[-~|:]|$)/g, "")
			// Remove remaining parenthetical content for better parsing
			.replace(/\s*\([^)]*\)/g, "")
			// Clean up extra whitespace
			.replace(/\s+/g, " ")
			.trim()
	);
}

/**
 * Helper function to clean video titles for better matching (more aggressive)
 */
export function cleanVideoTitle(title: string): string {
	return (
		title
			// Remove common video markers
			.replace(
				/\[(Official|Music|Video|Audio|Lyric|Live)\s?(Video|Audio|Music|Performance|MV)?\]/gi,
				"",
			)
			.replace(
				/\((Official|Music|Video|Audio|Lyric|Live)\s?(Video|Audio|Music|Performance|MV)?\)/gi,
				"",
			)
			// Remove HD, 4K quality markers
			.replace(/\b(HD|4K|1080p|720p|HQ|High Quality)\b/gi, "")
			// Remove featuring markers more aggressively
			.replace(/\s*[fF]t\.?\s+[\w\s&,]+/g, "")
			.replace(/\s*[Ff]eat\.?\s+[\w\s&,]+/g, "")
			.replace(/\s*[Ff]eaturing\.?\s+[\w\s&,]+/g, "")
			// Remove common prefixes/suffixes
			.replace(/^(The\s+)?(.+?)\s*-\s*(.+)$/, "$2 $3") // "Artist - Song" -> "Artist Song"
			.replace(/\s*\|\s*.*$/, "") // Remove everything after |
			.replace(/\s*[\[\(].*?[\]\)]/g, "") // Remove anything in brackets/parentheses
			// Remove extra whitespace and punctuation
			.replace(/[^\w\s]/g, " ")
			.replace(/\s+/g, " ")
			.trim()
	);
}

/**
 * Helper function to extract artist name from channel
 */
export function extractArtistFromChannel(channel: string): string {
	return cleanDanglingSeparators(
		channel
			// Remove common channel suffixes
			.replace(/\s*(Official|Music|VEVO|Records|Entertainment)$/gi, "")
			.replace(/\s*-.*$/, "") // Remove everything after dash
			.trim(),
	);
}
