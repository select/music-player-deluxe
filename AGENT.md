# [music-player-deluxe](https://github.com/select/music-player-deluxe/) Agent Guidelines

## Commands
`pnpm dev` (dev server) | `pnpm build` (production) | `pnpm lint` / `pnpm lint:fix` (ESLint) | `pnpm typecheck` (TS)

## Code Style
**TypeScript**: `<script setup lang="ts">` with `defineProps<>()`, `defineEmits<>()`. Use union types for literals, interfaces for objects, `Record<K,V>` for maps, explicit return types. ESLint enforces type-based props/emits.

**Imports**: ES6 only. Order: Nuxt/Vue → third-party → shared utils (auto-imported, never explicitly import) → local. Relative paths for local.

**Vue**: Always use `AppBtn.vue` (never `<button>`). Use `storeToRefs()` for Pinia (never destructure store). UnoCSS utilities only (no custom CSS). dayjs for dates. Colors: `bg-color`, `primary-1` (cards), `primary-3` (text), `accent` (gold).

**Error Handling**: try-catch in async functions. Log to console. Type errors as `unknown`, narrow type. Custom errors with messages. Graceful API failure handling.

## Repository Statistics
**Project**: music-player-deluxe (ESM module) | **Files**: 4,308 | **Lines**: 346,950 | **Size**: 10.42 MB  
**Components**: 22 Vue (6 admin, 3 app, 3 pages, 1 layout) | **API Endpoints**: 11 (5 playlists, 0 MusicBrainz, 0 songs)  
**Data**: 4,181 songs, 4.39 MB metadata | **Sources**: MusicBrainz, Last.fm, Odesli, Ollama | Run `pnpm stats:update` to refresh
