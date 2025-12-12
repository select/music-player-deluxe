#!/usr/bin/env node
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

// ============================================================
// TYPES
// ============================================================

// From Stage 4
export type TagBucket =
  | "STYLE_ONLY"
  | "STYLE_WITH_DESCRIPTORS"
  | "DESCRIPTORS_ONLY"
  | "PURE_INVALID";

export interface TagPostProcessEntry {
  normalized: string;
  totalCount: number;
  styles: string[];
  descriptors: string[];
  invalidParts: string[];
  bucket: TagBucket;
}

// From Stage 5B
export type StyleCanonicalAction = "keep" | "alias" | "reject";

export interface StyleCanonicalEntry {
  style: string;               // raw style string
  canonical_style: string;     // final canonical
  action: StyleCanonicalAction;
  reason: string;
  totalCount: number;          // usage of this raw style
}

// From Stage 5C
export interface StyleHierarchyEntry {
  style: string;               // canonical style
  is_subgenre: boolean;
  parent_genre: string;        // "" if none
  reason: string;
  totalCount: number;          // usage of this canonical style
}

// Stage 5D outputs

export type StyleKind = "genre" | "subgenre";

export interface StyleTaxonomyEntry {
  style: string;               // canonical style
  totalCount: number;
  kind: StyleKind;             // "genre" or "subgenre"
  parent_genres: string[];     // usually [] or [one parent]
  reason: string;
}

export interface GenreSummarySubgenre {
  name: string;
  totalCount: number;
}

export interface GenreSummaryEntry {
  genre: string;
  totalCount: number;          // usage for the genre itself
  subgenres: GenreSummarySubgenre[];
}

export interface TagStyleMapEntry {
  normalized: string;
  totalCount: number;
  canonicalStyles: string[];
  parentGenres: string[];
  descriptors: string[];
}

// ============================================================
// RUNTIME SETUP / CONFIG
// ============================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// data files are in: ../../data/tag-map-pipeline/

const STYLE_HIERARCHY_PATH = path.join(
  __dirname,
  "../../data/tag-map-pipeline/style-hierarchy.jsonl",
);

const STYLE_CANONICAL_MAP_PATH = path.join(
  __dirname,
  "../../data/tag-map-pipeline/style-canonical-map.jsonl",
);

const TAG_POSTPROCESSED_PATH = path.join(
  __dirname,
  "../../data/tag-map-pipeline/tag-compound-postprocessed.jsonl",
);

// outputs

const STYLE_TAXONOMY_PATH = path.join(
  __dirname,
  "../../data/tag-map-pipeline/style-taxonomy.jsonl",
);

const GENRE_SUMMARY_PATH = path.join(
  __dirname,
  "../../data/tag-map-pipeline/genre-summary.json",
);

const TAG_STYLE_MAP_PATH = path.join(
  __dirname,
  "../../data/tag-map-pipeline/tag-style-map.jsonl",
);

// ============================================================
// HELPERS
// ============================================================

function ensureFileDir(filePath: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readJsonlLines(filePath: string): string[] {
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, "utf8");
  return content
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

function appendJsonl(filePath: string, obj: unknown) {
  fs.appendFileSync(filePath, JSON.stringify(obj) + "\n", "utf8");
}

function dedupePreserveOrder<T>(values: T[]): T[] {
  const seen = new Set<T>();
  const out: T[] = [];
  for (const v of values) {
    if (!seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  return out;
}

// ============================================================
// LOAD INPUTS
// ============================================================

function loadStyleHierarchy(
  filePath: string = STYLE_HIERARCHY_PATH,
): StyleHierarchyEntry[] {
  const lines = readJsonlLines(filePath);
  const out: StyleHierarchyEntry[] = [];
  for (const line of lines) {
    try {
      const rec = JSON.parse(line) as StyleHierarchyEntry;
      if (rec && typeof rec.style === "string") {
        out.push(rec);
      }
    } catch {
      console.warn("⚠️ Skipping invalid style-hierarchy line:", line);
    }
  }
  return out;
}

function loadCanonicalMap(
  filePath: string = STYLE_CANONICAL_MAP_PATH,
): StyleCanonicalEntry[] {
  const lines = readJsonlLines(filePath);
  const out: StyleCanonicalEntry[] = [];
  for (const line of lines) {
    try {
      const rec = JSON.parse(line) as StyleCanonicalEntry;
      if (rec && typeof rec.style === "string") {
        out.push(rec);
      }
    } catch {
      console.warn("⚠️ Skipping invalid canonical-map line:", line);
    }
  }
  return out;
}

function loadTagPostprocessed(
  filePath: string = TAG_POSTPROCESSED_PATH,
): TagPostProcessEntry[] {
  const lines = readJsonlLines(filePath);
  const out: TagPostProcessEntry[] = [];
  for (const line of lines) {
    try {
      const rec = JSON.parse(line) as TagPostProcessEntry;
      if (rec && typeof rec.normalized === "string") {
        out.push(rec);
      }
    } catch {
      console.warn("⚠️ Skipping invalid tag-postprocessed line:", line);
    }
  }
  return out;
}

// ============================================================
// 5D.1: BUILD STYLE TAXONOMY
// ============================================================

function buildStyleTaxonomy(
  hierarchyEntries: StyleHierarchyEntry[],
): StyleTaxonomyEntry[] {
  const taxonomy: StyleTaxonomyEntry[] = [];

  for (const h of hierarchyEntries) {
    const kind: StyleKind = h.is_subgenre ? "subgenre" : "genre";
    const parent_genres =
      h.is_subgenre && h.parent_genre && h.parent_genre.trim().length > 0
        ? [h.parent_genre.trim()]
        : [];

    taxonomy.push({
      style: h.style,
      totalCount: h.totalCount,
      kind,
      parent_genres,
      reason: h.reason,
    });
  }

  // sort by totalCount desc for convenience
  taxonomy.sort((a, b) => b.totalCount - a.totalCount);

  return taxonomy;
}

function writeStyleTaxonomy(
  taxonomy: StyleTaxonomyEntry[],
  filePath: string = STYLE_TAXONOMY_PATH,
) {
  ensureFileDir(filePath);
  fs.writeFileSync(filePath, "", "utf8");
  for (const t of taxonomy) {
    appendJsonl(filePath, t);
  }
}

// ============================================================
// 5D.2: BUILD GENRE SUMMARY
// ============================================================

function buildGenreSummary(
  taxonomy: StyleTaxonomyEntry[],
): GenreSummaryEntry[] {
  const genreMap = new Map<string, GenreSummaryEntry>();

  for (const t of taxonomy) {
    if (t.kind === "genre") {
      // ensure genre entry exists
      const name = t.style;
      let g = genreMap.get(name);
      if (!g) {
        g = {
          genre: name,
          totalCount: 0,
          subgenres: [],
        };
        genreMap.set(name, g);
      }
      g.totalCount += t.totalCount;
    }
  }

  for (const t of taxonomy) {
    if (t.kind === "subgenre") {
      const subName = t.style;
      const parent = t.parent_genres[0] ?? "";
      if (!parent) continue;

      let g = genreMap.get(parent);
      if (!g) {
        // parent genre did not appear as a "genre" style itself; create it
        g = {
          genre: parent,
          totalCount: 0,
          subgenres: [],
        };
        genreMap.set(parent, g);
      }

      g.subgenres.push({
        name: subName,
        totalCount: t.totalCount,
      });
    }
  }

  // sort subgenres by totalCount desc
  for (const g of genreMap.values()) {
    g.subgenres.sort((a, b) => b.totalCount - a.totalCount);
  }

  // convert to array and sort genres by totalCount desc
  const allGenres = Array.from(genreMap.values());
  allGenres.sort((a, b) => b.totalCount - a.totalCount);

  return allGenres;
}

function writeGenreSummary(
  summary: GenreSummaryEntry[],
  filePath: string = GENRE_SUMMARY_PATH,
) {
  ensureFileDir(filePath);
  fs.writeFileSync(filePath, JSON.stringify(summary, null, 2), "utf8");
}

// ============================================================
// 5D.3: BUILD TAG → STYLE / GENRE MAP
// ============================================================

function buildCanonicalByRawStyle(
  canonicalEntries: StyleCanonicalEntry[],
): Map<string, StyleCanonicalEntry> {
  const map = new Map<string, StyleCanonicalEntry>();
  for (const c of canonicalEntries) {
    map.set(c.style, c);
  }
  return map;
}

function buildHierarchyByCanonical(
  hierarchyEntries: StyleHierarchyEntry[],
): Map<string, StyleHierarchyEntry> {
  const map = new Map<string, StyleHierarchyEntry>();
  for (const h of hierarchyEntries) {
    map.set(h.style, h);
  }
  return map;
}

function buildTagStyleMapEntries(
  tagEntries: TagPostProcessEntry[],
  canonicalMap: Map<string, StyleCanonicalEntry>,
  hierarchyMap: Map<string, StyleHierarchyEntry>,
): TagStyleMapEntry[] {
  const out: TagStyleMapEntry[] = [];

  for (const entry of tagEntries) {
    if (!entry.styles || entry.styles.length === 0) {
      // tags without styles could be skipped or included with empty styles
      continue;
    }

    const canonicalStyles: string[] = [];

    for (const s of entry.styles) {
      const raw = s.trim();
      if (!raw) continue;

      const c = canonicalMap.get(raw);
      if (!c) {
        // fallback: treat raw style as canonical
        canonicalStyles.push(raw);
        continue;
      }

      if (c.action === "reject") {
        // style was rejected as non-style
        continue;
      }

      const canon =
        c.canonical_style && c.canonical_style.trim().length > 0
          ? c.canonical_style.trim()
          : c.style;
      canonicalStyles.push(canon);
    }

    const uniqueCanonical = dedupePreserveOrder(canonicalStyles);
    if (uniqueCanonical.length === 0) {
      // no valid styles after canonicalization
      continue;
    }

    const parentGenres: string[] = [];

    for (const cs of uniqueCanonical) {
      const h = hierarchyMap.get(cs);
      if (!h) {
        // no hierarchy info; optional fallback:
        // treat the style itself as a "genre-like" parent
        parentGenres.push(cs);
        continue;
      }

      if (h.is_subgenre && h.parent_genre) {
        parentGenres.push(h.parent_genre);
      } else if (!h.is_subgenre) {
        parentGenres.push(cs);
      }
    }

    const uniqueParents = dedupePreserveOrder(parentGenres);

    const mapped: TagStyleMapEntry = {
      normalized: entry.normalized,
      totalCount: entry.totalCount,
      canonicalStyles: uniqueCanonical,
      parentGenres: uniqueParents,
      descriptors: entry.descriptors ?? [],
    };

    out.push(mapped);
  }

  return out;
}

function writeTagStyleMap(
  entries: TagStyleMapEntry[],
  filePath: string = TAG_STYLE_MAP_PATH,
) {
  ensureFileDir(filePath);
  fs.writeFileSync(filePath, "", "utf8");
  for (const e of entries) {
    appendJsonl(filePath, e);
  }
}

// ============================================================
// MAIN DRIVER
// ============================================================

export async function runStyleFinalizeStage(): Promise<void> {
  console.log("📥 Loading style hierarchy...");
  const hierarchyEntries = loadStyleHierarchy(STYLE_HIERARCHY_PATH);
  console.log(`🔢 hierarchy entries: ${hierarchyEntries.length}`);

  console.log("📥 Loading canonical style map...");
  const canonicalEntries = loadCanonicalMap(STYLE_CANONICAL_MAP_PATH);
  console.log(`🔢 canonical entries: ${canonicalEntries.length}`);

  console.log("📥 Loading tag postprocessed entries...");
  const tagEntries = loadTagPostprocessed(TAG_POSTPROCESSED_PATH);
  console.log(`🔢 tag entries: ${tagEntries.length}`);

  // 5D.1: Style taxonomy
  console.log("🧱 Building style taxonomy...");
  const taxonomy = buildStyleTaxonomy(hierarchyEntries);
  writeStyleTaxonomy(taxonomy, STYLE_TAXONOMY_PATH);
  console.log(`📄 style-taxonomy written → ${STYLE_TAXONOMY_PATH}`);

  // 5D.2: Genre summary
  console.log("🧱 Building genre summary...");
  const genreSummary = buildGenreSummary(taxonomy);
  writeGenreSummary(genreSummary, GENRE_SUMMARY_PATH);
  console.log(`📄 genre-summary written → ${GENRE_SUMMARY_PATH}`);

  // 5D.3: Tag → style/genre mapping
  console.log("🧱 Building tag-style map...");
  const canonicalMap = buildCanonicalByRawStyle(canonicalEntries);
  const hierarchyMap = buildHierarchyByCanonical(hierarchyEntries);
  const tagStyleMap = buildTagStyleMapEntries(
    tagEntries,
    canonicalMap,
    hierarchyMap,
  );
  writeTagStyleMap(tagStyleMap, TAG_STYLE_MAP_PATH);
  console.log(
    `📄 tag-style-map written (${tagStyleMap.length} entries) → ${TAG_STYLE_MAP_PATH}`,
  );

  console.log("✅ Stage 5D (style-finalize) complete.");
}

// ============================================================
// CLI ENTRY
// ============================================================

async function main() {
  try {
    await runStyleFinalizeStage();
  } catch (err) {
    console.error("❌ Error in stage-style-finalize:", err);
    process.exit(1);
  }
}

void main();
