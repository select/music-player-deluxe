# Odesli Integration

This document describes the Odesli integration for cross-platform music link discovery.

## Overview

The Odesli integration allows you to find music links across multiple streaming platforms (Spotify, Apple Music, YouTube Music, etc.) using YouTube video IDs. It's built using the [odesli.js](https://www.npmjs.com/package/odesli.js) library which connects to the [Odesli API](https://odesli.co/).

## Module Location

The main module is located at: `server/utils/odesli.ts`

## Main Functions

### `getOdesliSongData(youtubeId: string): Promise<OdesliResult>`

Fetches song data from the Odesli API using a YouTube ID.

**Parameters:**
- `youtubeId` (string): The YouTube video ID

**Returns:**
- Promise that resolves to either `OdesliSongData` or `OdesliErrorResult`

**Example:**
```typescript
import { getOdesliSongData, isOdesliError } from "~/server/utils/odesli";

const result = await getOdesliSongData("dQw4w9WgXcQ");

if (isOdesliError(result)) {
  console.error("Error:", result.error);
} else {
  console.log("Song:", result.title);
  console.log("Artist:", result.artist.join(", "));
  console.log("Available on:", Object.keys(result.linksByPlatform));
}
```

### `getBatchOdesliSongData(youtubeIds: string[], concurrency?: number): Promise<OdesliResult[]>`

Fetches song data for multiple YouTube IDs with concurrency control.

**Parameters:**
- `youtubeIds` (string[]): Array of YouTube video IDs
- `concurrency` (number, optional): Maximum concurrent requests (default: 3)

**Returns:**
- Promise that resolves to array of `OdesliResult` objects

**Example:**
```typescript
import { getBatchOdesliSongData, isOdesliError } from "~/server/utils/odesli";

const youtubeIds = ["dQw4w9WgXcQ", "kJQP7kiw5Fk", "9bZkp7q19f0"];
const results = await getBatchOdesliSongData(youtubeIds, 2);

results.forEach((result, index) => {
  if (isOdesliError(result)) {
    console.log(`Song ${index + 1}: Error - ${result.error}`);
  } else {
    console.log(`Song ${index + 1}: ${result.title} by ${result.artist.join(", ")}`);
  }
});
```

### `isOdesliError(result: OdesliResult): result is OdesliErrorResult`

Type guard function to check if the result is an error.

### `extractPlatformLinks(songData: OdesliSongData): Record<string, string>`

Extracts streaming platform links from Odesli data.

**Example:**
```typescript
const links = extractPlatformLinks(songData);
// Returns: { spotify: "https://open.spotify.com/...", appleMusic: "https://music.apple.com/...", ... }
```

### `getAvailablePlatforms(songData: OdesliSongData): string[]`

Gets available platforms for a song.

**Example:**
```typescript
const platforms = getAvailablePlatforms(songData);
// Returns: ["spotify", "appleMusic", "youtube", "youtubeMusic", ...]
```

## Data Types

### `OdesliSongData`

```typescript
interface OdesliSongData {
  entityUniqueId: string;
  title: string;
  artist: string[];
  type: string;
  thumbnail?: string;
  userCountry: string;
  pageUrl: string;
  linksByPlatform: Record<string, PlatformLink>;
  entitiesByUniqueId: Record<string, EntityData>;
}
```

### `OdesliErrorResult`

```typescript
interface OdesliErrorResult {
  error: string;
  youtubeId: string;
}
```

## Supported Platforms

The integration supports links for the following platforms:

- Spotify
- Apple Music
- iTunes
- YouTube Music
- YouTube
- Google Play Music
- Pandora
- Deezer
- Tidal
- Amazon Music
- SoundCloud
- Napster
- Yandex Music
- Spinrilla

## Rate Limiting

**Important:** The Odesli API has rate limits:

- **Without API key**: 10 requests per minute
- **With API key**: Higher limits (contact `developers@song.link` for API key)

The module includes basic retry logic and timeout handling. For production use, consider:

1. Getting an API key from Odesli
2. Implementing additional client-side rate limiting
3. Caching results to reduce API calls

## Test Endpoint

A test endpoint is available at `/api/test-odesli?id=YOUTUBE_ID` to test the integration.

**Example:**
```
GET /api/test-odesli?id=dQw4w9WgXcQ
```

**Response:**
```json
{
  "success": true,
  "data": {
    "title": "Rick Astley - Never Gonna Give You Up",
    "artist": ["Rick Astley"],
    "type": "song",
    "thumbnail": "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
    "pageUrl": "https://song.link/y/dQw4w9WgXcQ",
    "availablePlatforms": ["spotify", "appleMusic", "youtube", "youtubeMusic"],
    "platformLinks": {
      "spotify": "https://open.spotify.com/track/...",
      "appleMusic": "https://music.apple.com/us/album/...",
      "youtube": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "youtubeMusic": "https://music.youtube.com/watch?v=dQw4w9WgXcQ"
    }
  },
  "meta": {
    "userCountry": "US",
    "entityUniqueId": "YOUTUBE_VIDEO::dQw4w9WgXcQ",
    "totalPlatforms": 4
  }
}
```

## Error Handling

The module uses a safe error handling approach:

- Functions return error objects instead of throwing exceptions
- Use `isOdesliError()` to check for errors
- Detailed error messages are logged to console
- Graceful degradation when API is unavailable

## Configuration

The module is configured with sensible defaults:

```typescript
const odesli = new Odesli({
  cache: true,           // Enable caching
  timeout: 10000,        // 10 second timeout
  maxRetries: 3,         // Retry failed requests 3 times
  retryDelay: 1000,      // 1 second delay between retries
});
```

To add an API key, modify the initialization in `server/utils/odesli.ts`:

```typescript
const odesli = new Odesli({
  apiKey: 'your-api-key-here',
  cache: true,
  timeout: 10000,
  maxRetries: 3,
  retryDelay: 1000,
});
```

## Integration with Existing Code

The odesli module can be easily integrated with existing MusicBrainz workflows:

```typescript
// In an API endpoint or server function
import { getOdesliSongData, isOdesliError } from "~/server/utils/odesli";
import { getMusicBrainzArtistTags } from "~/server/utils/musicbrainzArtistTags";

// Get cross-platform links for a video
const odesliData = await getOdesliSongData(youtubeId);

if (!isOdesliError(odesliData)) {
  // Also get MusicBrainz data if available
  const artistTags = await getMusicBrainzArtistTags(songMbid);
  
  // Combine the data
  const enrichedData = {
    ...odesliData,
    artistTags,
    streamingLinks: extractPlatformLinks(odesliData),
  };
}
```

## Best Practices

1. **Cache Results**: Store Odesli results to avoid repeated API calls
2. **Batch Requests**: Use `getBatchOdesliSongData()` for multiple songs
3. **Error Handling**: Always check for errors using `isOdesliError()`
4. **Rate Limiting**: Respect API limits, especially without an API key
5. **Fallback**: Have fallback behavior when Odesli data is unavailable
6. **User Experience**: Show loading states during API calls