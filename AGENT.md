# Agent Development Guidelines

## Commands
`pnpm dev` (dev server) | `pnpm build` (production) | `pnpm lint` / `pnpm lint:fix` (ESLint) | `pnpm typecheck` (TS) | `pnpm stats:update` (stats/repo)

## Code Style
**TypeScript**: `<script setup lang="ts">` with `defineProps<>()`, `defineEmits<>()`. Use union types for literals, interfaces for objects, `Record<K,V>` for maps, explicit return types. ESLint enforces type-based props/emits.

**Imports**: ES6 only. Order: Nuxt/Vue → third-party → shared utils (auto-imported, never explicitly import) → local. Relative paths for local.

**Vue**: Always use `AppBtn.vue` (never `<button>`). Use `storeToRefs()` for Pinia (never destructure store). UnoCSS utilities only (no custom CSS). dayjs for dates. Colors: `bg-color`, `primary-1` (cards), `primary-3` (text), `accent` (gold).

**Error Handling**: try-catch in async functions. Log to console. Type errors as `unknown`, narrow type. Custom errors with messages. Graceful API failure handling.
