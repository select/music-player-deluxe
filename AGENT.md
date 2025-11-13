# Agent Development Guidelines

## TypeScript Requirements

All Vue components and JavaScript files in this project MUST use TypeScript:

### Vue Components
- Use `<script setup lang="ts">` for all Vue components
- Define proper TypeScript interfaces for props using `defineProps<{...}>()`
- Use `withDefaults()` for default prop values
- Define emit interfaces using `defineEmits<{...}>()`
- Type all computed properties and functions with proper return types

### Example Component Structure
```vue
<script setup lang="ts">
const props = withDefaults(defineProps<{
  variant?: "primary" | "secondary";
  disabled?: boolean;
}>(), {
  variant: "primary",
  disabled: false,
});

defineEmits<{
  click: [event: MouseEvent];
}>();
</script>
```

### General TypeScript Guidelines
1. Use union types for string literals instead of validators
2. Define interfaces for all object types
3. Use `Record<K, V>` for mapped object types
4. Explicitly type function parameters and return values
5. Use proper generic constraints where applicable

### Color Scheme
The project uses a dark theme with the following UnoCSS color variables:
- `bg-color`: #1b1919 (main background)
- `bg-gradient`: rgba(49,47,47,.8) (hover states)
- `primary-1`: #000 (card backgrounds)
- `primary-2`: #576b87 (button backgrounds)
- `primary-3`: #a4b3c9 (accent/secondary text)
- `primary-4`: #fff (primary text)
- `accent`: gold (accent color for primary buttons and highlights)

### Component Standards
- ALWAYS use the `AppBtn.vue` component when a button is needed - never use raw `<button>` elements
- Global link styling uses accent color (`text-primary-3`) without underlines
- Maintain consistent spacing and typography using UnoCSS utilities
- Use UnoCSS utility classes instead of custom CSS when available (e.g., `animate-spin` instead of custom keyframes)
- Always use Tailwind's `line-clamp-<number>` utilities instead of custom CSS for text truncation

### Auto-imported Functions
- NEVER import functions from `shared/utils` - all utility functions are auto-imported by Nuxt
- Functions like `parseArtistAndTitle`, `extractArtistFromChannel`, etc. are available globally
- If you need to use a utility function, simply call it directly without importing

### Store Usage Guidelines
- When accessing reactive state from Pinia stores, ALWAYS use `storeToRefs()`:
  ```ts
  // ✅ Correct
  const { currentKeyboardShortcuts } = storeToRefs(useUserSettingsStore());
  
  // ❌ Incorrect - loses reactivity
  const userSettingsStore = useUserSettingsStore();
  const shortcuts = computed(() => userSettingsStore.currentKeyboardShortcuts);
  ```
- Use destructuring with renaming when needed:
  ```ts
  const { currentVideos: playlist } = storeToRefs(usePlaylistStore());
  ```
- Store refs from `storeToRefs()` are already reactive - don't wrap them in `computed()`
- For store actions, you can destructure them directly from the store instance:
  ```ts
  // ✅ Preferred - destructure actions directly
  const { loadFirstPlaylist, setCurrentPlaylistVideos } = usePlaylistStore();
  const { currentPlaylist, currentVideos } = storeToRefs(usePlaylistStore());
  
  // Then use them directly
  await loadFirstPlaylist();
  setCurrentPlaylistVideos(newVideos);
  
  // ❌ Less preferred - using store instance
  const playlistStore = usePlaylistStore();
  playlistStore.setCurrentPlaylistVideos(newVideos);
  ```

### Development Tools
- Use `pnpx nuxi typecheck` instead of `npx nuxi typecheck` for TypeScript checking
- Use `pnpx` instead of `npx` for all Nuxt CLI commands when possible
- This ensures consistency with the project's pnpm package manager setup
