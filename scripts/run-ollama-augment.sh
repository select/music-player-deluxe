#!/bin/bash

# Ollama Augment Script Runner
# This script runs the Ollama augmentation process for playlist entries without artist information
# It makes API requests to extract metadata but does not modify the playlist file

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo -e "${BLUE}🤖 Ollama Playlist Augmentation Script${NC}"
echo -e "${BLUE}=====================================${NC}"

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Error: Node.js is not installed or not in PATH${NC}"
    exit 1
fi

# Check if tsx is available
if ! command -v tsx &> /dev/null; then
    echo -e "${YELLOW}⚠️  tsx not found globally, trying to use npx...${NC}"
    TSX_CMD="npx tsx"
else
    TSX_CMD="tsx"
fi

# Check if Ollama is running
echo -e "${BLUE}🔍 Checking Ollama service...${NC}"
if ! curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo -e "${RED}❌ Error: Ollama is not running on localhost:11434${NC}"
    echo -e "${YELLOW}Please start Ollama with: ollama serve${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Ollama is running${NC}"

# Check if required model is available
echo -e "${BLUE}🔍 Checking for required model (gemma2:2b)...${NC}"
if ! curl -s http://localhost:11434/api/tags | grep -q "gemma2:2b"; then
    echo -e "${YELLOW}⚠️  Model gemma2:2b not found. Attempting to pull...${NC}"
    if ! ollama pull gemma2:2b; then
        echo -e "${RED}❌ Error: Failed to pull gemma2:2b model${NC}"
        echo -e "${YELLOW}Please manually run: ollama pull gemma2:2b${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}✅ Model gemma2:2b is available${NC}"

# Check if dev server is running
echo -e "${BLUE}🔍 Checking if Nuxt dev server is running...${NC}"
if ! curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo -e "${RED}❌ Error: Nuxt dev server is not running on localhost:3000${NC}"
    echo -e "${YELLOW}Please start the dev server with: npm run dev or pnpm dev${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Nuxt dev server is running${NC}"

# Check if playlist file exists
PLAYLIST_FILE="$PROJECT_DIR/public/playlist/PLHh-DPsAXiAUVUVA9DpRtiYRrwgvqg8Fx.json"
if [ ! -f "$PLAYLIST_FILE" ]; then
    echo -e "${RED}❌ Error: Playlist file not found at $PLAYLIST_FILE${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Playlist file found${NC}"

# Create data directory if it doesn't exist
DATA_DIR="$PROJECT_DIR/data"
if [ ! -d "$DATA_DIR" ]; then
    echo -e "${BLUE}📁 Creating data directory...${NC}"
    mkdir -p "$DATA_DIR"
fi

echo -e "${BLUE}🚀 Starting Ollama augmentation process...${NC}"
echo -e "${YELLOW}This will process all playlist entries without an artist field${NC}"
echo -e "${YELLOW}No rate limiting will be applied - requests will be made sequentially${NC}"
echo -e "${YELLOW}Metadata will be stored server-side via API calls (playlist file unchanged)${NC}"
echo

# Confirmation prompt
read -p "Continue? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Aborted by user${NC}"
    exit 0
fi

# Run the script
echo -e "${BLUE}🎵 Running Ollama augmentation script...${NC}"
cd "$PROJECT_DIR"

if $TSX_CMD "$SCRIPT_DIR/ollama-augment.ts"; then
    echo -e "${GREEN}✅ Ollama augmentation completed successfully!${NC}"
else
    echo -e "${RED}❌ Ollama augmentation failed${NC}"
    exit 1
fi

echo -e "${BLUE}🎉 Process completed!${NC}"
