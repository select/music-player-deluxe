# MusicBrainz Enhancement Script

This script (`musicbrainz-enhance.ts`) enhances existing song metadata files with additional MusicBrainz data for songs that already have `trackMbid` and `artistMbid` but are missing enhanced fields.

## What it does

The script adds three new fields to the `musicbrainz` object in song metadata files:

1. **`releasedAt`** - The oldest release event date for the track
2. **`artistCountry`** - The artist's country as ISO 3166-1 code (e.g., "US", "GB")
3. **`externalIds`** - A record of external platform IDs for the artist

## Usage

```bash
# Run the enhancement script
pnpm run augment:musicbrainz-enhance

# Or directly with tsx
tsx scripts/musicbrainz-enhance.ts
```

## Requirements

- Songs must already have `musicbrainz.trackMbid` and `musicbrainz.artistMbid`
- Songs missing any of the three enhanced fields will be processed
- Rate limited to 1 second between API calls (plus 300ms between individual lookups)

## Enhanced Data Structure

Before enhancement:
```json
{
  "musicbrainz": {
    "trackMbid": "6b3567f6-7f69-4e91-b292-8b4fdf5a692d",
    "artistMbid": "ef954679-5ee7-4016-acef-7ac71f2fa3d8",
    "artistGenres": ["hip hop"]
  }
}
```

After enhancement:
```json
{
  "musicbrainz": {
    "trackMbid": "6b3567f6-7f69-4e91-b292-8b4fdf5a692d",
    "artistMbid": "ef954679-5ee7-4016-acef-7ac71f2fa3d8",
    "artistGenres": ["hip hop"],
    "releasedAt": "1971",
    "artistCountry": "US",
    "externalIds": {
      "allmusic": "mn0000932045",
      "bandcamp": "https://atmosphere.bandcamp.com/",
      "discogs": "57765",
      "spotify": "1GAS0rb4L8VTPvizAx2O9J",
      "lastfm": "Atmosphere"
    }
  }
}
```

## Supported External Platforms

The script extracts external IDs for the following platforms:

- **Spotify** - Artist IDs
- **Apple Music** - Artist IDs  
- **Discogs** - Artist IDs
- **AllMusic** - Artist IDs
- **Bandcamp** - Full URLs
- **SoundCloud** - Username/handle
- **YouTube** - Channel IDs
- **Last.fm** - Artist names

## Error Handling

- Failed processing attempts are tracked in `data/musicbrainz-enhance-fail.json`
- Network timeouts are retried on subsequent runs
- API errors are logged and skipped permanently
- Graceful shutdown on SIGINT/SIGTERM

## Rate Limiting

- 1 second between song processing
- 300ms between individual API calls (recording + artist lookups)
- Respects MusicBrainz API guidelines

## Output

The script provides detailed logging showing:
- Progress through the song collection
- Successful data retrieval for each field
- Number of external IDs found per artist
- Final summary statistics

Example output:
```
[1/2412] Processing: --WsoQt6U4o
Song: Get Fly
Track MBID: 6b3567f6-7f69-4e91-b292-8b4fdf5a692d
Artist MBID: ef954679-5ee7-4016-acef-7ac71f2fa3d8
   Fetching enhanced recording data...
   Fetching enhanced artist data...
   Found artist country code: US (United States)
   Found external ID - allmusic: mn0000932045
   Found external ID - bandcamp: https://atmosphere.bandcamp.com/
   Found external ID - discogs: 57765
   Found external ID - spotify: 1GAS0rb4L8VTPvizAx2O9J
   Found external ID - lastfm: Atmosphere
   ✅ Successfully fetched enhanced MusicBrainz data
✅ Successfully enhanced song with MusicBrainz data
```

## Related Scripts

- `musicbrainz-augment.ts` - Main script that finds and adds initial MusicBrainz data
- `lastfm-augment-find.ts` - Adds Last.fm metadata
- `odesli-augment.ts` - Adds streaming platform links