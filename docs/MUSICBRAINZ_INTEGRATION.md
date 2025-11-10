# MusicBrainz Integration Documentation

## Overview

This document describes the complete MusicBrainz integration that has been implemented in the Music Playlist View application. The integration allows users to match YouTube videos with detailed music metadata from the MusicBrainz database.

## Features

### ✨ Core Functionality

- **Smart Video Matching**: Automatically searches MusicBrainz for recordings that match YouTube video titles and channels
- **Multiple Match Selection**: Shows users multiple potential matches with confidence scores
- **Metadata Extraction**: Retrieves comprehensive music data including artist, title, album, tags, and duration
- **Local Caching**: Stores matched metadata as JSON files for quick access
- **Bulk Processing**: Process multiple videos at once with progress tracking
- **Data Export**: Export all matched metadata as JSON

### 🎯 Key Benefits

- **Album Filtering**: Prioritizes primary releases over compilations
- **Smart Title Cleaning**: Removes video-specific markers for better matching
- **Rate Limiting Safe**: Uses official musicbrainz-api library with proper headers
- **TypeScript Support**: Full type safety throughout the application
- **Responsive UI**: Works seamlessly on desktop and mobile devices

## API Endpoints

### 1. Search for Matches
```
POST /api/musicbrainz/search
```

Searches MusicBrainz for recordings matching a YouTube video.

**Request Body:**
```typescript
{
  video: {
    id: string;
    title: string;
    channel: string;
    duration: string;
    thumbnail: string;
    url: string;
  }
}
```

**Response:**
```typescript
{
  success: boolean;
  results: Array<{
    id: string;           // MusicBrainz Recording ID
    title: string;        // Song title
    artist: string;       // Primary artist name
    album?: string;       // Album name (primary releases only)
    score: number;        // Match confidence (0-100)
    disambiguation?: string;
  }>;
  query: string;          // Cleaned search query used
}
```

### 2. Match Selection
```
POST /api/musicbrainz/match
```

Stores the user's selected match and fetches full metadata.

**Request Body:**
```typescript
{
  videoId: string;        // YouTube video ID
  selectedMbid: string;   // Selected MusicBrainz Recording ID
}
```

**Response:**
```typescript
{
  success: boolean;
  data: {
    mbid: string;         // MusicBrainz Recording ID
    title: string;        // Song title
    artist: string;       // Primary artist
    album?: string;       // Album name
    tags: string[];       // Genre and style tags
    duration?: number;    // Duration in seconds
    youtubeId: string;    // YouTube video ID
    lastFetched: string;  // ISO timestamp
  };
  cached: boolean;
}
```

### 3. Retrieve Cached Data
```
GET /api/songs/{youtubeId}
```

Gets previously matched and cached song metadata.

**Response:**
```typescript
{
  success: boolean;
  data: MusicBrainzSongData;
  cached: true;
}
```

## File Storage

Matched metadata is stored in `server/assets/songs/` as JSON files:

**File Structure:**
```
server/assets/songs/
├── dQw4w9WgXcQ.json    # YouTube video ID as filename
├── kJQP7kiw5Fk.json
└── ...
```

**File Content Example:**
```json
{
  "mbid": "b25c8d13-a8a3-4159-8c0a-fa72c3e19e45",
  "title": "Never Gonna Give You Up",
  "artist": "Rick Astley",
  "album": "Whenever You Need Somebody",
  "tags": ["pop", "dance", "80s", "new wave"],
  "duration": 213,
  "youtubeId": "dQw4w9WgXcQ",
  "lastFetched": "2024-01-15T10:30:00.000Z"
}
```

## User Interface

### VideoList Component Integration

The `VideoList.vue` component has been enhanced with MusicBrainz functionality:

#### Visual States

1. **No Data**: Shows "No music data" placeholder
2. **Search Results**: Displays up to 3 potential matches with scores
3. **Matched Data**: Shows artist, title, album, and tags with color-coded tags
4. **Loading States**: Animated loading indicators during API calls

#### User Actions

- **Search**: Individual video search button
- **Select Match**: Click on search results to confirm match
- **Refresh**: Re-search for better matches
- **Clear**: Remove matched data
- **Bulk Search**: Process all unmatched videos
- **Export**: Download all matched data as JSON

#### Progress Tracking

- Real-time progress bar for bulk operations
- Match completion statistics
- Processing status indicators

## Usage Examples

### Basic Integration in Vue Component

```vue
<template>
  <VideoList :videos="playlistVideos" />
</template>

<script setup lang="ts">
import type { Video } from '~/types'

const playlistVideos = ref<Video[]>([
  {
    id: 'dQw4w9WgXcQ',
    title: 'Rick Astley - Never Gonna Give You Up (Official Video)',
    channel: 'Rick Astley',
    duration: '3:33',
    thumbnail: 'https://...',
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
  }
])
</script>
```

### Manual API Usage

```typescript
// Search for matches
const searchResponse = await $fetch('/api/musicbrainz/search', {
  method: 'POST',
  body: { video: videoData }
})

// Match with selected result
const matchResponse = await $fetch('/api/musicbrainz/match', {
  method: 'POST',
  body: {
    videoId: 'dQw4w9WgXcQ',
    selectedMbid: 'b25c8d13-a8a3-4159-8c0a-fa72c3e19e45'
  }
})

// Retrieve cached data
const cachedData = await $fetch('/api/songs/dQw4w9WgXcQ')
```

## Demo Page

A dedicated demo page is available at `/musicbrainz` featuring:

- **Playlist Selection**: Choose from available cached playlists
- **Usage Instructions**: Step-by-step guide for the workflow
- **Interactive Video List**: Full MusicBrainz functionality
- **Real-time Statistics**: Track matching progress

## Technical Implementation

### Smart Search Algorithm

The search implementation uses multiple strategies:

1. **Exact Matching**: `recording:"Title" AND artist:"Artist"`
2. **Fuzzy Matching**: `"Title" AND artist:"Artist"`
3. **Fallback Search**: `Title Artist` (simple query)

### Title Cleaning

Video titles are automatically cleaned to improve matching:

- Removes `[Official Video]`, `(Music Video)`, etc.
- Strips quality indicators (`HD`, `4K`, `1080p`)
- Eliminates featuring artists (`ft.`, `feat.`, `featuring`)
- Removes channel-specific suffixes

### Album Filtering

Only primary album releases are shown:
- Excludes compilation albums (MusicBrainz type: `dd2a21e1-0c00-3729-a7a0-de60b84eb5d1`)
- Prioritizes original studio releases
- Shows most relevant album context

### Error Handling

Comprehensive error handling covers:
- Network timeouts and API failures
- Invalid MusicBrainz responses
- File system errors during caching
- User input validation

## Performance Considerations

### Rate Limiting

- Uses official `musicbrainz-api` library with built-in rate limiting
- Includes proper User-Agent headers as required by MusicBrainz
- Implements delays between bulk requests (500ms)

### Caching Strategy

- Local file caching prevents duplicate API calls
- 7-day cache expiration for metadata freshness
- Instant loading for previously matched videos

### UI Responsiveness

- Non-blocking async operations
- Progressive loading with skeleton states
- Optimistic UI updates

## Troubleshooting

### Common Issues

1. **No Search Results**
   - Video title may be too generic or modified
   - Artist name might not match MusicBrainz database
   - Try manual search with simplified terms

2. **Slow Bulk Processing**
   - Rate limiting is intentional to respect MusicBrainz servers
   - Process in smaller batches if needed
   - Check network connectivity

3. **Cache Issues**
   - Cached files are stored in `server/assets/songs/`
   - Check file permissions if saving fails
   - Clear browser cache if UI shows stale data

### Debug Information

Enable debug logging by checking browser console for:
- Search queries being executed
- API response details
- File system operations
- Error
