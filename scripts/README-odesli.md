# Odesli Test Script

This directory contains a test script for the Odesli integration that allows you to test cross-platform music link discovery from the command line.

## Overview

The Odesli test script (`test-odesli.ts`) takes a YouTube video ID as input and fetches comprehensive song data including links to multiple streaming platforms like Spotify, Apple Music, YouTube Music, and many others.

## Usage

### Using pnpm (recommended)

```bash
pnpm test-odesli <youtube-id>
```

### Using tsx directly

```bash
tsx scripts/test-odesli.ts <youtube-id>
```

## Examples

### Test with Rick Astley's "Never Gonna Give You Up"
```bash
pnpm test-odesli dQw4w9WgXcQ
```

### Test with another popular song
```bash
pnpm test-odesli kJQP7kiw5Fk
```

## Output

The script provides detailed output including:

### Basic Information
- Song title and artist
- Media type (song/album)
- Country region
- Thumbnail image URL

### Platform Links
- Links to all available streaming platforms
- Platform-specific icons and formatted names
- Direct URLs for each service

### Technical Details
- Entity unique ID
- Total number of entities found
- Platform link count
- Detailed metadata for each platform

### Example Output
```
🎵 Testing Odesli Integration
==================================================
📹 YouTube ID: dQw4w9WgXcQ
🔗 YouTube URL: https://www.youtube.com/watch?v=dQw4w9WgXcQ

⏳ Fetching song data from Odesli API...
✅ Request completed in 1049ms

🎉 Success! Song data retrieved:
==================================================
📋 Basic Information:
   Title: Rick Astley - Never Gonna Give You Up
   Artist: Rick Astley
   Type: song
   Country: US

🎵 Available Platforms (17):
   🎶 Spotify: https://open.spotify.com/track/4PTG3Z6ehGkBFwjybzWkR8
   🍎 Apple Music: https://geo.music.apple.com/us/album/_/...
   🎵 YouTube Music: https://music.youtube.com/watch?v=dQw4w9WgXcQ
   [... and more platforms]
```

## Error Handling

The script handles various error scenarios gracefully:

### Invalid YouTube ID
```bash
pnpm test-odesli invalidid123
# Shows: ❌ Error Result: HTTP 400: Bad Request
```

### Missing Arguments
```bash
pnpm test-odesli
# Shows usage instructions
```

### Network Issues
- Displays timeout or connection errors
- Shows stack trace for debugging
- Exits with appropriate error codes

## Supported Platforms

The script can discover links for these platforms:

- **Music Streaming**: Spotify, Apple Music, YouTube Music, Tidal, Deezer
- **Purchase**: iTunes, Amazon Music, Google Play Music
- **Free/Social**: SoundCloud, YouTube, Audiomack
- **Regional**: Yandex Music, Anghami, Boomplay
- **Radio**: Pandora, Napster

## Rate Limiting

⚠️ **Important**: The Odesli API has rate limits:
- **Without API key**: 10 requests per minute
- **With API key**: Higher limits

For production use or frequent testing, consider getting an API key from `developers@song.link`.

## Troubleshooting

### Common Issues

1. **"tsx: command not found"**
   - Use `pnpm test-odesli` instead of direct tsx command
   - Or install tsx globally: `npm install -g tsx`

2. **Rate limit exceeded**
   - Wait a minute before trying again
   - Consider getting an API key for higher limits

3. **No results found**
   - Verify the YouTube ID is valid
   - Some videos may not be available in music databases
   - Try with a different, more popular song

4. **Network timeouts**
   - Check internet connection
   - API may be temporarily unavailable
   - Script has 10-second timeout by default

### Debug Mode

For debugging, you can modify the script temporarily:
- Add `console.log()` statements
- Increase timeout values
- Enable verbose error logging

## Related Files

- `../server/utils/odesli.ts` - Main Odesli integration module
- `../docs/ODESLI_INTEGRATION.md` - Comprehensive API documentation
- `../server/api/test-odesli.get.ts` - HTTP API endpoint for testing

## Development

To modify or extend the test script:

1. Edit `scripts/test-odesli.ts`
2. Follow TypeScript and project coding standards
3. Test
