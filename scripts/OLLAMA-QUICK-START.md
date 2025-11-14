# Ollama JSON Augmentation - Quick Start Guide

This guide will help you quickly set up and use Ollama with Gemma3:4b to augment your JSON files with AI-generated music metadata.

## 🚀 Quick Setup (5 minutes)

### 1. Install Ollama

**macOS/Linux:**
```bash
curl -fsSL https://ollama.ai/install.sh | sh
```

**Windows:**
Download from: https://ollama.ai/download

### 2. Start Ollama Server
```bash
ollama serve
```
*Keep this terminal open*

### 3. Test the Setup
```bash
# In a new terminal, run the test suite
pnpm run test-augment

# Or test with a specific model
tsx scripts/test-ollama-augmentation.ts --model=gemma2:9b
```

### 4. Process Your Data
```bash
# Process the main metadata file
pnpm run augment-json extracted-missing-metadata.json

# The output will be saved as: extracted-missing-metadata.augmented.json
```

## 🎯 Most Common Use Cases

### Process Existing Metadata
```bash
# Basic usage - processes entries without AI metadata
pnpm run augment-json extracted-missing-metadata.json
```

### Custom Input/Output Files
```bash
pnpm run augment-json input-file.json output-file.json
```

### Use Better Quality Model
```bash
tsx scripts/augment-json-with-ollama.ts input.json --model gemma2:9b
```

## 📊 Expected Results

**Input:**
```json
[
  {
    "title": "Queen - Bohemian Rhapsody (Official Video)",
    "channel": "Queen Official"
  }
]
```

**Output:**
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
  }
]
```

## 🔧 Troubleshooting

### Ollama Not Running
**Error:** `Cannot connect to Ollama`
**Solution:**
```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# If not, start it
ollama serve
```

### Model Not Found
**Error:** `Model not found`
**Solution:** The script will automatically download the model, but you can also do it manually:
```bash
ollama pull gemma2:2b
```

### Out of Memory
**Error:** `Model loading failed`
**Solutions:**
- Use a smaller model: `--model gemma2:2b`
- Reduce batch size: `--batch-size 1`
- Close other applications
- For 8GB RAM: Use `gemma2:2b`
- For 16GB+ RAM: Use `gemma2:9b` or larger

### Slow Processing
**Solutions:**
- Use a smaller model for faster processing
- Increase batch size: `--batch-size 10`
- Use GPU acceleration (if available)

## 📈 Performance Guide

| Model | RAM Needed | Speed | Quality | Best For |
|-------|------------|-------|---------|----------|
| `gemma2:2b` | 4-8GB | Fast | Good | Testing, quick processing |
| `gemma2:9b` | 8-16GB | Medium | Better | Production use |
| `gemma2:27b` | 16GB+ | Slow | Best | High-quality results |
| `llama3.1:8b` | 8-16GB | Medium | Excellent | Balanced choice |

## 💡 Pro Tips

1. **Start Small:** Test with `gemma2:2b` before using larger models
2. **Batch Processing:** Increase `--batch-size` for faster processing (if your hardware can handle it)
3. **Incremental Updates:** The script only processes entries without AI metadata, so you can run it multiple times safely
4. **Quality Check:** Use the test suite to validate model performance before processing large datasets

## 🔗 Command Reference

```bash
# Basic augmentation
pnpm run augment-json input.json

# Full options
tsx scripts/augment-json-with-ollama.ts input.json output.json \
  --model gemma2:9b \
  --host http://localhost:11434 \
  --batch-size 5

# Run tests
pnpm run test-augment

# Check available models
ollama list
```

## 📞 Need Help?

1. **Check the full documentation:** `scripts/README-ollama-augmentation.md`
2. **Run the test suite:** `pnpm run test-augment`
3. **Verify Ollama status:** `curl http://localhost:11434/api/tags`
4. **Check model availability:** `ollama list`

---

**Time to first result:** ~5-10 minutes (including model download)
**Processing speed:** ~2-10 entries per minute (depending on model and hardware)