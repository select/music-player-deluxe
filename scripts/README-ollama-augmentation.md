# JSON Augmentation with Ollama

This script uses Ollama with the Gemma3:4b model (or other compatible models) to augment JSON files containing music metadata by extracting artist names, track titles, and genre tags from YouTube video titles and channel names.

## Prerequisites

1. **Ollama Server**: You need to have Ollama running locally or accessible via network
   - Install Ollama from: https://ollama.ai/
   - Start the Ollama server: `ollama serve`
   - Default host: `http://localhost:11434`

2. **Model**: The script will automatically pull the required model if it's not available
   - Default model: `gemma2:2b` (lighter, faster)
   - Recommended for better quality: `gemma2:9b` or `gemma2:27b`
   - You can also use: `llama3.1:8b`, `qwen2.5:7b`, etc.

## Usage

### Basic Usage

```bash
# Process the default missing metadata file
pnpm run augment-json extracted-missing-metadata.json

# Or using tsx directly
tsx scripts/augment-json-with-ollama.ts extracted-missing-metadata.json
```

### Advanced Usage

```bash
# Specify custom input and output files
pnpm run augment-json input.json output.json

# Use a different model
tsx scripts/augment-json-with-ollama.ts input.json --model gemma2:9b

# Connect to remote Ollama server
tsx scripts/augment-json-with-ollama.ts input.json --host http://192.168.1.100:11434

# Adjust batch size (number of concurrent requests)
tsx scripts/augment-json-with-ollama.ts input.json --batch-size 3

# Combine options
tsx scripts/augment-json-with-ollama.ts data/music.json data/music-augmented.json --model llama3.1:8b --batch-size 10
```

## Command Line Options

- `input-file`: Path to the input JSON file (required)
- `output-file`: Path to the output JSON file (optional, defaults to `<input>.augmented.json`)
- `--model`: Ollama model to use (default: `gemma2:2b`)
- `--host`: Ollama server URL (default: `http://localhost:11434`)
- `--batch-size`: Number of entries to process concurrently (default: 5)

## Input Format

The script expects JSON files with entries containing at least `title` and `channel` fields:

```json
[
  {
    "title": "Queen - Bohemian Rhapsody (Official Video)",
    "channel": "Queen Official"
  },
  {
    "title": "Miles Davis - Kind of Blue (Full Album)",
    "channel": "Jazz Classics"
  }
]
```

## Output Format

The script adds an `ai` field to each entry with extracted metadata:

```json
[
  {
    "title": "Queen - Bohemian Rhapsody (Official Video)",
    "channel": "Queen Official",
    "ai": {
      "artist": "Queen",
      "track": "Bohemian Rhapsody",
      "tags": ["rock", "classic rock", "progressive rock"]
    }
  },
  {
    "title": "Miles Davis - Kind of Blue (Full Album)",
    "channel": "Jazz Classics",
    "ai": {
      "artist": "Miles Davis",
      "track": "Kind of Blue",
      "tags": ["jazz", "cool jazz", "modal jazz"]
    }
  }
]
```

## Features

- **Incremental Processing**: Only processes entries that don't already have `ai` metadata
- **Batch Processing**: Processes multiple entries concurrently with configurable batch size
- **Error Handling**: Continues processing even if individual entries fail
- **Model Auto-Pull**: Automatically downloads the specified model if not available locally
- **Intelligent Extraction**: Removes common YouTube suffixes and cleans up titles
- **Genre Tagging**: Generates relevant music genre tags based on content analysis

## Recommended Models

| Model | Size | Speed | Quality | Use Case |
|-------|------|-------|---------|----------|
| `gemma2:2b` | ~1.6GB | Fast | Good | Quick processing, limited resources |
| `gemma2:9b` | ~5.4GB | Medium | Better | Balanced performance and quality |
| `gemma2:27b` | ~16GB | Slow | Best | High-quality extraction, powerful hardware |
| `llama3.1:8b` | ~4.7GB | Medium | Excellent | Good all-around choice |
| `qwen2.5:7b` | ~4.4GB | Fast | Very Good | Fast and accurate |

## Performance Tips

1. **Batch Size**: 
   - Increase for faster processing (if your hardware can handle it)
   - Decrease if you experience timeouts or memory issues
   - Default of 5 works well for most setups

2. **Model Selection**:
   - Use smaller models (`gemma2:2b`) for quick testing
   - Use larger models (`gemma2:9b`, `llama3.1:8b`) for production

3. **Hardware Requirements**:
   - Minimum 8GB RAM for `gemma2:2b`
   - 16GB+ RAM recommended for larger models
   - GPU acceleration supported by Ollama for faster inference

## Troubleshooting

### Connection Issues
```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# If using custom host, ensure it's accessible
curl http://your-host:11434/api/tags
```

### Model Issues
```bash
# List available models
ollama list

# Pull a specific model manually
ollama pull gemma2:2b
```

### Memory Issues
- Reduce batch size: `--batch-size 1`
- Use a smaller model: `--model gemma2:2b`
- Close other applications to free up RAM

### Quality Issues
- Use a larger, more capable model
- Check the input data for consistency
- Review the generated prompts in the script

## Integration

The script can be easily integrated into CI/CD pipelines or automated workflows:

```bash
# Example: Process new metadata daily
#!/bin/bash
date=$(date +%Y%m%d)
tsx scripts/augment-json-with-ollama.ts daily-metadata.json "augmented-$date.json" --model gemma2:9b
```

## Contributing

To improve the script:

1. **Prompt Engineering**: Modify the `createPrompt` method for better extraction
2. **Error Handling**: Enhance error recovery and retry logic  
3. **Output Formats**: Add support for different output formats (CSV, XML, etc.)
4. **Model Support**: Add support for other LLM providers (OpenAI, Anthropic, etc.)

## Examples

### Processing Missing Metadata
```bash
# Process the main missing metadata file
tsx scripts/augment-json-with-ollama.ts extracted-missing-metadata.json

# Output will be: extracted-missing-metadata.augmented.json
```

### Batch Processing Multiple Files
```bash
# Process multiple files in a loop
for file in data/*.json; do
  tsx scripts/augment-json-with-ollama.ts "$file" "${file%.json}.augmented.json"
done
```

### Quality Check
```bash
# Use a high-quality model for final processing
tsx scripts/augment-json-with-ollama.ts final-data.json \
  --model gemma2:27b \
  --batch-size 2 \
  --host http://gpu-server:11434
```
