## Tag-Map v2 Pipeline with Blacklist Filtering

This script builds a **normalized tag map** for your music library using multiple LLM-powered stages (canonicalization, splitting, classification, descriptor extraction, subgenre detection) plus a **local blacklist pre-filter**.

File: `ollama-tag-map-v2.ts` (a.k.a. `filterBlacklistedTags.ts` in your context)

---

### 1. Purpose

The pipeline takes **raw tags from song metadata** (Last.fm, MusicBrainz, local tags), cleans and analyzes them through several stages, and produces a structured `TagMapEntry` for each original tag.

Main goals:

* Normalize messy tags to a canonical form.
* Split compound tags into parts.
* Classify tags into types (genre, subgenre, mood, descriptor, invalid, other).
* Extract descriptors and distinguish valid / invalid ones.
* Detect subgenres and their parent genres.
* Remove unwanted tags using a **central blacklist**.
* Persist results in a resumable, JSONL-based cache.

---

### 2. Inputs & Outputs

#### Inputs

* **Song metadata**: `SONGS_DIR = ../server/assets/songs`

  * All `*.json` / `*.json5` files.
  * Tag sources per file:

    * `data.tags` (local tags)
    * `data.lastfm.tags`
    * `data.musicbrainz.artistTags`
    * `data.musicbrainz.artistGenres`
    * `data.musicbrainz.genres`

* **Blacklist**: `BLACKLIST_PATH = ../server/assets/tag-blacklist.json`

  * Expected structure:

    ```json
    {
      "blacklistedTags": [
        "example tag 1",
        "example tag 2"
      ]
    }
    ```
  * All blacklist entries are normalized (`normalizeTagString`) and stored in a `Set<string>`.

* **LLM Prompts** (plain text files):

  * `tag-canonicalizer-prompt.txt`
  * `tag-splitter-prompt.txt`
  * `tag-classifier-prompt.txt`
  * `tag-descriptor-prompt.txt`
  * `tag-subgenre-prompt.txt`

* **Environment variables**

  * `TAG_MAP_MODEL` (default: `"gemma3:4b"`)
  * `OLLAMA_HOST` (default: `"http://localhost:11434"`)

* **CLI flags**

  * `--limit` / `--limit=N` / `-l`
    Limits how many unique tags are processed (useful for debugging).

#### Outputs

* **Tag-map results**
  `RESULTS_PATH = ../data/tag-map-results.jsonl`
  Each line is a JSON `TagMapEntry`:

  ```ts
  interface TagMapEntry {
    source: string;              // original raw tag
    normalized_tags: string[];   // final normalized tags after pipeline
    tag_types: string[];         // aligned with normalized_tags
    canonical_stage: CanonicalTag;
    split_stage: SplitResult;
    classification_stage: ClassifiedTag[];
    descriptor_stage: DescriptorInfo[];
    subgenre_stage: SubgenreInfo[];
    model: string;
    created_at: string;
  }
  ```

---

### 3. Normalization Helper

`normalizeTagString(s: string): string`

* Lowercases the string.
* Trims whitespace.
* Collapses multiple spaces to a single space.

This is used consistently to:

* Normalize tags before comparisons.
* Normalize LLM outputs.
* Normalize blacklist entries.

---

### 4. Blacklist Pipeline (Stage 0)

#### 4.1 Loading the blacklist

```ts
function loadBlacklist(p: string = BLACKLIST_PATH): Set<string> {
  // 1) Read JSON file
  // 2) Expect data.blacklistedTags to be an array
  // 3) Filter to strings and normalize each
  // 4) Return Set<string> of normalized tags
}
```

* If the file doesn’t exist or is invalid:

  * Logs a warning.
  * Returns an empty `Set`.

* All blacklist entries are **normalized**, so every check must normalize the tag first.

#### 4.2 Filtering raw tags

```ts
function filterBlacklistedTags(rawTags: string[]): {
  kept: string[];
  removed: string[];
}
```

* For each raw tag:

  * Normalizes it.
  * If the normalized form is in `blacklist`:

    * Adds to `removed`.
  * Otherwise:

    * Adds to `kept`.

* Returns:

  * `kept`: tags that should enter the LLM pipeline.
  * `removed`: tags filtered out by the blacklist (for logging / debug).

This function is used in `main()` right after deduplication:

```ts
const { kept: tagsAfterBlacklist, removed: blacklisted } =
  filterBlacklistedTags(uniqueRawTags);

console.log(`   → Blacklisted tags removed: ${blacklisted.length}`);
console.log(`   → Tags entering Tag-Map pipeline: ${tagsAfterBlacklist.length}`);
```

#### 4.3 Optional post-filter hook

```ts
function applyBlacklistToFinalTags(tags: string[], blacklist: Set<string>): string[] {
  return tags.filter((t) => !blacklist.has(normalizeTagString(t)));
}
```

* Designed to be used **after** the full pipeline (on `finalTags`) as a safety net.
* Currently defined but not wired into `buildTagMapForBatch`.
* Recommended integration point: right before `dedupTags` is computed.

---

### 5. Main LLM Stages

All LLM calls go through `ollamaChat`, then `cleanModelOutput` and `parseJsonArray` to ensure valid JSON arrays are processed.

#### 5.1 Canonicalizer (Stage 1)

`runCanonicalizerBatch(tags: string[]): Promise<CanonicalTag[]>`

* Input: array of raw tags.

* Output: `CanonicalTag[]`:

  ```ts
  interface CanonicalTag {
    source: string;      // original raw tag
    canonical: string;   // normalized canonical form
    action: CanonicalAction; // identity / abbreviation_to_full / alias_to_canonical / spellfix_to_canonical
    reason: string;
  }
  ```

* Purpose: unify aliases, fix spelling, etc.

#### 5.2 Splitter (Stage 2)

`runSplitterBatch(tags: string[]): Promise<SplitResult[]>`

* Input: canonical strings from Stage 1.

* Output: `SplitResult[]`:

  ```ts
  interface SplitResult {
    source: string;  // canonical string
    parts: string[]; // normalized parts (e.g. "rock / metal" -> ["rock","metal"])
    reason: string;
  }
  ```

* Purpose: split compound tags (e.g. “rock / metal”, “dark ambient drone”).

#### 5.3 Classifier (Stage 3)

`runClassifierBatch(tags: string[]): Promise<ClassifiedTag[]>`

* Input: **unique parts** from all splits.

* Output: `ClassifiedTag[]`:

  ```ts
  type TagClass = "genre" | "subgenre" | "mood" | "descriptor" | "invalid" | "other";

  interface ClassifiedTag {
    source: string;   // normalized part
    class: TagClass;  // category of this part
    reason: string;
  }
  ```

* Purpose: assign high-level tag type per part.

#### 5.4 Descriptor extractor (Stage 4)

`runDescriptorBatch(tags: string[]): Promise<DescriptorInfo[]>`

* Input: same unique parts.

* Output: `DescriptorInfo[]`:

  ```ts
  interface DescriptorInfo {
    source: string;
    genre_like: string;           // not used as primary genre source anymore
    descriptors: string[];        // valid descriptors (may be moods, textures, etc.)
    invalid_descriptors: string[];// should be ignored
    reason: string;
  }
  ```

* In `buildTagMapForBatch`, descriptors are added as:

  * `tag_type = "mood"` if classifier says class === "mood".
  * Otherwise `tag_type = "descriptor"`.
  * `invalid_descriptors` are deliberately ignored.

#### 5.5 Subgenre mapper (Stage 5)

`runSubgenreBatch(tags: string[]): Promise<SubgenreInfo[]>`

* Input: only parts classified as `genre` or `subgenre`.

* Output: `SubgenreInfo[]`:

  ```ts
  interface SubgenreInfo {
    source: string;      // normalized tag
    is_subgenre: boolean;
    parent_genre: string; // normalized broad genre if is_subgenre === true
    reason: string;
  }
  ```

* This stage is the **primary source of truth** for genre/subgenre decisions in the final tag list.

---

### 6. TagMapEntry Assembly

`buildTagMapForBatch(rawTags: string[], modelName: string): Promise<TagMapEntry[]>`

For each `raw` tag in the batch:

1. Look up its `CanonicalTag`.

   * If missing, create a **fallback** entry:

     * `canonical = normalizeTagString(raw)`
     * `normalized_tags = [canonical]`
     * `tag_types = ["other"]`
     * Empty stage arrays.

2. Otherwise:

   * Obtain its `SplitResult` (or fallback with one part = canonical string).

   * For each `part`:

     * Normalize: `partNorm`.
     * Look up:

       * `cls = classBySource.get(partNorm)`
       * `desc = descBySource.get(partNorm)`
       * `sub = subBySource.get(partNorm)`
     * Add to `relevantStrings` for stage info later.

   * **Genre/Subgenre logic (priority on subgenre stage):**

     * If `sub` exists:

       * If `sub.is_subgenre`:

         * Add the subgenre itself:

           * `finalTags.push(base)`
           * `finalTypes.push("subgenre")`
         * Add `parent_genre` (if present and not yet added):

           * `finalTags.push(parent)`
           * `finalTypes.push("genre")`
       * Else:

         * Add `base` as plain genre:

           * `finalTags.push(base)`
           * `finalTypes.push("genre")`
     * Else if no `sub` but classifier says `genre`/`subgenre`:

       * Use classifier as fallback:

         * `finalTags.push(partNorm)`
         * `finalTypes.push("genre" | "subgenre")`.

   * **Descriptors:**

     * For each `d` in `desc.descriptors`:

       * Normalize `dNorm`.
       * Add to `finalTags`.
       * Determine type:

         * If classifier class is `mood` → `tag_type = "mood"`.
         * Else → `tag_type = "descriptor"`.

   * **Fallback when no tags were added**:

     * Use canonical string as a single `"other"` tag.

   * **Deduplicate & align types**:

     * `dedupTags = Array.from(new Set(finalTags))`
     * Adjust `tag_types` length to match `dedupTags`
       (`pad with "other"` or truncate).

   * **Assemble stage-specific info** for this tag:

     * `classification_stage`: all classifier results for strings in `relevantStrings`.
     * `descriptor_stage`: all descriptor results for `relevantStrings`.
     * `subgenre_stage`: all subgenre results for `relevantStrings`.

   * Build final `TagMapEntry` and push to `entries`.

---

### 7. Main Execution Flow

`main()`:

1. Log model info.
2. Load all tags from songs: `loadAllTagsFromSongs()`.
3. Deduplicate raw tags → `uniqueSet` → `uniqueRawTags`.
4. **Stage 0: blacklist filtering**:

   * `filterBlacklistedTags(uniqueRawTags)` → `tagsAfterBlacklist`.
5. Apply CLI `--limit` if given → `uniqueTags`.
6. Load existing results from `RESULTS_PATH`:

   * Build `processed` = set of already mapped tag `source`s.
7. Compute `todo = uniqueTags.filter((t) => !processed.has(t))`.
8. If `todo` empty → exit early.
9. Split `todo` into batches of size `BATCH_SIZE`.
10. For each batch:

    * Call `buildTagMapForBatch(batch, MODEL_NAME)`.
    * Append results to JSONL (`appendJsonl`).
    * Add each `r.source` to `processed`.
11. Log completion.

This makes the script **resumable**: subsequent runs will skip tags already present in `RESULTS_PATH`.
