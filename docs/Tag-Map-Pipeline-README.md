# 🎼 Tag-Map-Pipeline (Updated 2025 Edition)
A fully modular, LLM-assisted pipeline for transforming raw music tags into a rich semantic tag map used by **Tags Music Player**.

This version includes the complete 6-stage conceptual pipeline, implemented as **9 concrete script stages**, ending in the new **Final Mapping** step, which produces the JSON mapping used directly by the app (`server/assets/tag-expanded-mappings.json`).

---

# 📚 Table of Contents
1. Overview
2. Pipeline Diagram
3. Pipeline Stages
4. File Outputs Overview
5. Running the Pipeline
6. Override Architecture
7. Notes on Style Taxonomy
8. Final Mapping Format (App-Ready)
9. Contributing

---

# 1. ⭐ Overview

The **Tag-Map-Pipeline** ingests all tags collected from:
- `lastfm.tags`
- `musicbrainz.genres`
- local song metadata

…and transforms them into structured components:

- canonical styles  
- genre/subgenre hierarchy  
- descriptors (future)  
- blacklist candidates  
- final tag→expanded-genre mappings for the app  

This pipeline is deterministic, resume-safe, and override-driven.

---

# 2. 🗺 Pipeline Diagram (Mermaid)

```mermaid
flowchart TD

  subgraph S1[Stage 1: Collect Raw Tags]
    A1[stage-tag-collect.ts]
  end

  subgraph S2[Stage 2: Normalize Tags]
    A2[stage-tag-normalize.ts]
  end

  subgraph S3[Stage 3: Compound Interpretation]
    A3[stage-tag-compound.ts]
  end

  subgraph S4[Stage 4: Postprocess Compounds]
    A4[stage-tag-compound-postprocess.ts]
  end

  subgraph S5[Stage 5A–D: Style Mapping]
    A5a[stage-style-harvest.ts]
    A5b[stage-style-canonical.ts]
    A5c[stage-style-hierarchy.ts]
    A5d[stage-style-finalize.ts]
  end

  subgraph S6[Stage 6: Final Mapping (App)]
    A6[stage-finalize-mapping.ts]
  end

  A1 -->|tag-raw.jsonl| A2
  A2 -->|tag-normalized.jsonl| A3
  A3 -->|tag-compound-stage.jsonl| A4
  A4 -->|tag-compound-postprocessed.jsonl| A5a
  A5a -->|style-raw-summary.jsonl| A5b
  A5b -->|style-canonical-map.jsonl| A5c
  A5c -->|style-hierarchy.jsonl| A5d
  A5d -->|tag-style-map.jsonl| A6

  A5d -->|style-taxonomy.jsonl,<br/>genre-summary.json| A6
  A6 -->|tag-expanded-mappings.json| OUT[App: server/assets]
```

---

# 3. 🧱 Pipeline Stages (Full)

## **Stage 1 – Collect Raw Tags**
Reads all song files and extracts raw tags from multiple metadata sources.

Script:
```bash
pnpm tsx scripts/tag-map-pipeline/stage-tag-collect.ts
```

Output:
```text
data/tag-map-pipeline/tag-raw.jsonl
```

---

## **Stage 2 – Normalize Tag Strings**
Normalizes casing, whitespace, punctuation, Unicode, and deduplication.

Script:
```bash
pnpm tsx scripts/tag-map-pipeline/stage-tag-normalize.ts
```

Output:
```text
data/tag-map-pipeline/tag-normalized.jsonl
```

---

## **Stage 3 – Compound Interpretation (LLM)**
Uses a Gemma 3 model to segment tags into parts:

- `style`
- `descriptor` (future)
- `invalid`

Script:
```bash
pnpm tsx scripts/tag-map-pipeline/stage-tag-compound.ts
```

Output:
```text
data/tag-map-pipeline/tag-compound-stage.jsonl
```

Resume support included.

---

## **Stage 4 – Postprocessing**
Buckets tag structures:

- `STYLE_ONLY`
- `STYLE_WITH_DESCRIPTORS`
- `DESCRIPTORS_ONLY`
- `PURE_INVALID`

Generates:
- cleaned canonical structure for each tag  
- auto-blacklist candidates  
- supports overrides  

Script:
```bash
pnpm tsx scripts/tag-map-pipeline/stage-tag-compound-postprocess.ts
```

Outputs:
```text
data/tag-map-pipeline/tag-compound-postprocessed.jsonl
data/tag-map-pipeline/tag-auto-blacklist-candidates.jsonl
```

Override file:
```text
data/tag-map-pipeline/tag-compound-stage-override.jsonl
```

---

## **Stage 5A – Style Harvest**
Extracts all style-like parts from Stage 4 output and aggregates:

- totalCount (usage)
- example tags

Script:
```bash
pnpm tsx scripts/tag-map-pipeline/stage-style-mapping.ts harvest
```

Output:
```text
data/tag-map-pipeline/style-raw-summary.jsonl
```

---

## **Stage 5B – Style Canonicalization (LLM)**
Normalizes style spellings and aliases.

Example:
```text
"psychadelic rock" → "psychedelic rock"
```

Script:
```bash
pnpm tsx scripts/tag-map-pipeline/stage-style-mapping.ts canonicalize
```

Output:
```text
data/tag-map-pipeline/style-canonical-map.jsonl
```

---

## **Stage 5C – Style Hierarchy (LLM)**
Classifies each **canonical** style as:

- `genre` (broad)
- `subgenre` (with a parent)

Script:
```bash
pnpm tsx scripts/tag-map-pipeline/stage-style-hierarchy.ts
```

Output:
```text
data/tag-map-pipeline/style-hierarchy.jsonl
```

---

## **Stage 5D – Final Taxonomy + Tag→Style Map**
Builds:

- `style-taxonomy.jsonl` — machine-friendly genre/subgenre listing  
- `genre-summary.json` — summary for UI (genres + subgenres sorted by popularity)  
- `tag-style-map.jsonl` — tag→(canonicalStyles, parentGenres)

Script:
```bash
pnpm tsx scripts/tag-map-pipeline/stage-style-finalize.ts
```

Outputs:
```text
data/tag-map-pipeline/style-taxonomy.jsonl
data/tag-map-pipeline/genre-summary.json
data/tag-map-pipeline/tag-style-map.jsonl
```

---

## **Stage 6 – Final Mapping (App-Ready)**
Takes results from Stage 5D and emits **a single compact JSON file**:

✔ each normalized tag maps to **one or more expanded genre tags**  
✔ used directly by the app  
✔ descriptor support is planned for later  
✔ includes `updated_at` timestamp  

Script:
```bash
pnpm tsx scripts/tag-map-pipeline/stage-finalize-mapping.ts
```

Format:
```json
{
  "updated_at": "2025-12-12T12:00:00.000Z",
  "mappings": {
    "psychedelic rock": ["psychedelic rock", "rock"],
    "deep house": ["deep house", "house"],
    "ambient": ["ambient"]
  }
}
```

Location:
```text
server/assets/tag-expanded-mappings.json
```

---

# 4. 📂 File Outputs Overview

| Stage | File | Description |
|-------|------|-------------|
| 1 | tag-raw.jsonl | collected tags |
| 2 | tag-normalized.jsonl | deduped + normalized tags |
| 3 | tag-compound-stage.jsonl | LLM segmentation |
| 4 | tag-compound-postprocessed.jsonl | cleaned structured tags |
| 4 | tag-compound-stage-override.jsonl | manual fixes |
| 4 | tag-auto-blacklist-candidates.jsonl | invalid-only tags |
| 5A | style-raw-summary.jsonl | aggregated style parts |
| 5B | style-canonical-map.jsonl | aliasing + canonical |
| 5C | style-hierarchy.jsonl | genres + subgenres |
| 5D | style-taxonomy.jsonl | canonical taxonomy |
| 5D | genre-summary.json | parent genre → subgenres |
| 5D | tag-style-map.jsonl | per-tag styles+genres |
| 6 | tag-expanded-mappings.json | app-ready mapping file |

---

# 5. ▶ Running the Pipeline

## a) Full pipeline

You can use the dedicated runner script:

```bash
pnpm run:tag-map-pipe
```

Which is equivalent to:

```bash
pnpm tsx scripts/run-tag-map-pipeline.ts
```

This runs all stages (1 → 9).

---

## b) Run only specific stages

The runner supports `--from` and `--to`:

```bash
pnpm run:tag-map-pipe -- --from 3 --to 6
```

Examples:

- **Run only compound + postprocess:**
  ```bash
  pnpm run:tag-map-pipe -- --from 3 --to 4
  ```

- **Run only style stages:**
  ```bash
  pnpm run:tag-map-pipe -- --from 5 --to 8
  ```

- **Regenerate only final app mapping:**
  ```bash
  pnpm run:tag-map-pipe -- --from 9 --to 9
  ```

---

# 6. 🛠 Override Architecture

Overrides may occur on:

### ✔ Stage 3 — Compound Interpretation  
Correct misclassified styles/descriptors.

### ✔ Stage 4 — Postprocess  
Repair bucket classification.

### ✔ Stage 5B — Style Canonicalization  
Force alias → canonical.

### ✔ Stage 5C — Hierarchy  
Fix parent genre relationships.

Overrides should never modify raw files — they are layered on top, so the raw data is always reproducible.

---

# 7. 🎶 Notes on Style Taxonomy

- A **style** is anything the model marks as `style` in compound tagging.
- A **subgenre** is a style with a parent genre.
- Total usage (`totalCount`) is used for:
  - weighting taxonomy
  - sorting genre summaries
  - pruning rare styles (optional)

You may later add:
- multi-parent support for fusion genres
- descriptor taxonomies (origin, mood, sound, context)
- descriptor expansion into the final mapping

---

# 8. 🎯 Final Mapping Format (Stage 6)

The app reads:

```text
server/assets/tag-expanded-mappings.json
```

Schema:

```ts
interface FinalMappingFile {
  updated_at: string;                     // ISO timestamp
  mappings: Record<string, string[]>;     // normalized tag → expanded tags
}
```

Example:

```json
{
  "updated_at": "2025-12-12T11:52:33.000Z",
  "mappings": {
    "psychedelic rock": ["psychedelic rock", "rock"],
    "deep house": ["deep house", "house"],
    "ambient": ["ambient"]
  }
}
```

This allows the app to:

- instantly obtain parent genres  
- treat subgenres as genres  
- unify style tagging across the entire library  

Descriptors will be added to this file once descriptor canonicalization and taxonomy are introduced.

---

# 9. ❤️ Contributing

You can:
- add override entries  
- adjust canonicalization rules  
- add descriptor taxonomy later  
- propose improvements to prompts or stage logic  

The pipeline is fully modular — additional stages can be added without breaking existing components.

---

🚀 *Tag-Map-Pipeline is now fully documented and ready for stable use in your music player ecosystem!*
