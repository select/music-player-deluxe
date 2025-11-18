# Scripts Documentation

## odesli-augment.js

This script calls the `/api/metadata/odesli-augment` endpoint for all playlist entries that don't have an "externalIds" field populated.

### Purpose

The script helps augment playlist data by fetching external platform IDs (Spotify, Apple Music, etc.) from the Odesli API for YouTube videos that are missing this metadata.

### Features

- **Smart filtering**: Only processes videos without existing `externalIds`
- **Failure tracking**: Maintains a fail list to avoid retrying permanently failed requests
- **Rate limiting**: Waits 30 seconds between API calls to respect rate limits
- **Progress tracking**: Shows detailed progress and statistics
- **Graceful shutdown**: Handles SIGINT/SIGTERM signals properly

### Usage

1. **Start the development server** (required for the API endpoint):
   ```bash
   npm run dev
   # or
   pnpm dev
   ```

2. **Run the script** (in a separate terminal):
   ```bash
   node scripts/odesli-augment.js
   ```

### Files

- **Input**: `public/playlist/PLHh-DPsAXiAUVUVA9DpRtiYRrwgvqg8Fx.json` - The playlist data
- **Output**: `data/odesli-fail.json` - Tracks video IDs that failed to get external IDs
- **API Data**: `server/assets/songs/{videoId}.json` - Individual song metadata files created by the API

### Error Handling

The script handles different types of errors:

- **404 errors**: Added to fail list to avoid retrying
- **4xx errors**: Added to fail list (client errors)
- **5xx errors**: Not added to fail list (temporary server errors, can retry)
- **Network errors**: Not added to fail list (temporary, can retry)

### Output

The script provides detailed console output including:
- Progress counter (e.g., `[1/933] Processing: videoId`)
- Video title and artist information
- Success/failure status with details
- Platform coverage (e.g., "Found on: spotify, appleMusic, tidal...")
- Final summary with success/failure counts

### Rate Limiting

The script waits 30 seconds between each API request to avoid overwhelming the Odesli service. This means:
- Processing 933 videos will take approximately 7.7 hours
- You can interrupt with Ctrl+C and resume later (failed IDs are remembered)

### Resuming

If the script is interrupted:
1. Failed video IDs are saved in `data/odesli-fail.json`
2. Successfully processed videos will have `externalIds` in the playlist
3. Re-running the script will automatically skip both categories
4. Only unprocessed videos will be attempted

### Example Output

```
Starting odesli-augment script...
Rate limit: 30 seconds between requests
Loaded playlist with 1258 videos
Found 0 previously failed IDs
Found 933 videos to process

[1/933] Processing: imn8jY_UJg8
Title: Jon Hopkins - Luminous Beings
Artist: Jon Hopkins
✅ Success! External IDs found and saved.
   Found on: spotify, appleMusic, tidal...
⏱️  Waiting 30 seconds...

[2/933] Processing: XOGWbaOOeCM
Title: Steely Dan ~ King Of The World ~ Countdown To Ecstasy  (HQ Audio)
Artist: N/A
❌ Failed: HTTP 404: Not Found
   Added to fail list to avoid retrying
⏱️  Waiting 30 seconds...

=== Summary ===
Total processed: 933
Successful: 856
Failed: 77
Total failed IDs in database: 77

Failed IDs are saved in: /path/to/data/odesli-fail.json
Script completed!
```
