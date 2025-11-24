#!/bin/bash

# Playlist Statistics Analyzer
# Analyzes public/playlist/PLHh-DPsAXiAUVUVA9DpRtiYRrwgvqg8Fx.json

PLAYLIST_FILE="public/playlist/PLHh-DPsAXiAUVUVA9DpRtiYRrwgvqg8Fx.json"

# Show help message
show_help() {
    echo "Playlist Statistics Analyzer"
    echo "Usage: $0 [OPTIONS]"
    echo
    echo "Options:"
    echo "  -h, --help     Show this help message"
    echo "  -f FILE        Specify custom playlist file path"
    echo
    echo "Default file: $PLAYLIST_FILE"
    echo
    echo "This script analyzes a playlist JSON file and provides statistics about:"
    echo "  • Basic playlist information"
    echo "  • Tag usage and distribution"
    echo "  • External platform link coverage"
    echo "  • Artist and metadata statistics"
    echo
    echo "Requirements: jq (JSON processor)"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -f|--file)
            PLAYLIST_FILE="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use -h or --help for usage information"
            exit 1
            ;;
    esac
done

# Check if file exists
if [ ! -f "$PLAYLIST_FILE" ]; then
    echo "Error: Playlist file not found at $PLAYLIST_FILE"
    exit 1
fi

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo "Error: jq is required but not installed"
    exit 1
fi

echo "🎵 Playlist Statistics for $(jq -r '.title' "$PLAYLIST_FILE")"
echo "=================================================="
echo

# Basic playlist info
echo "📊 Basic Information:"
echo "  • Playlist ID: $(jq -r '.id' "$PLAYLIST_FILE")"
echo "  • Title: $(jq -r '.title' "$PLAYLIST_FILE")"
echo "  • Total Videos: $(jq -r '.videoCount' "$PLAYLIST_FILE")"
echo "  • Actual Video Count: $(jq '.videos | length' "$PLAYLIST_FILE")"
echo

# Tag statistics
echo "🏷️  Tag Statistics:"
total_videos=$(jq '.videos | length' "$PLAYLIST_FILE")
videos_with_tags=$(jq '[.videos[] | select(.tags != null and (.tags | length) > 0)] | length' "$PLAYLIST_FILE")
videos_without_tags=$((total_videos - videos_with_tags))
tag_percentage=$(echo "scale=1; $videos_with_tags * 100 / $total_videos" | bc -l 2>/dev/null || echo "N/A")

echo "  • Videos with tags: $videos_with_tags ($tag_percentage%)"
echo "  • Total unique tags: $(jq '[.videos[].tags[]?] | unique | length' "$PLAYLIST_FILE")"
echo "  • Average tags per video: $(jq '[.videos[] | select(.tags != null) | .tags | length] | add / length' "$PLAYLIST_FILE" 2>/dev/null | xargs printf "%.1f" 2>/dev/null || echo "0")"
echo

# Most common tags (top 10)
echo "🔥 Top 10 Most Common Tags:"
jq -r '[.videos[].tags[]?] | group_by(.) | map({tag: .[0], count: length}) | sort_by(.count) | reverse | .[0:10] | .[] | "  • \(.tag): \(.count) videos"' "$PLAYLIST_FILE"
echo

# External platform statistics
echo "🔗 External Platform Statistics:"
platforms=$(jq -r '[.videos[] | select(.externalIds != null and (.externalIds | type) == "object") | .externalIds | keys[]] | unique | sort | .[]' "$PLAYLIST_FILE")

for platform in $platforms; do
    count=$(jq --arg platform "$platform" '[.videos[] | select(.externalIds != null and (.externalIds | type) == "object" and .externalIds[$platform] != null)] | length' "$PLAYLIST_FILE")
    percentage=$(echo "scale=1; $count * 100 / $total_videos" | bc -l 2>/dev/null || echo "N/A")
    printf "  • %-15s: %4d videos (%s%%)\n" "$platform" "$count" "$percentage"
done
echo

# Platform coverage summary
echo "📈 Platform Coverage Summary:"
videos_with_external=$(jq '[.videos[] | select(.externalIds != null and (.externalIds | type) == "object" and (.externalIds | keys | length) > 0)] | length' "$PLAYLIST_FILE")
videos_without_external=$((total_videos - videos_with_external))
external_percentage=$(echo "scale=1; $videos_with_external * 100 / $total_videos" | bc -l 2>/dev/null || echo "N/A")

echo "  • Videos with external links: $videos_with_external ($external_percentage%)"
echo "  • Average platforms per video: $(jq '[.videos[] | select(.externalIds != null and (.externalIds | type) == "object") | .externalIds | keys | length] | add / length' "$PLAYLIST_FILE" 2>/dev/null | xargs printf "%.1f" 2>/dev/null || echo "0")"
echo



# Top artists (if available)
echo "🎤 Top 10 Artists (by video count):"
jq -r '[.videos[] | select(.artist != null and .artist != "")] | group_by(.artist) | map({artist: .[0].artist, count: length}) | sort_by(.count) | reverse | .[0:10] | .[] | "  • \(.artist): \(.count) videos"' "$PLAYLIST_FILE"
echo

echo "✅ Analysis complete!"
echo
echo "💡 Tips:"
echo "  • Use './playlist-stats.sh -f <file>' to analyze a different playlist"
echo "  • Use './playlist-stats.sh -h' for help and options"
