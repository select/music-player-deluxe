#!/usr/bin/env node
import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

// Resolve local path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --------------------------
// Pipeline definition
// --------------------------

const stages = [
  {
    id: 1,
    name: "Stage 1 – Collect raw tags",
    script: "scripts/tag-map-pipeline/stage-tag-collect.ts",
  },
  {
    id: 2,
    name: "Stage 2 – Normalize tags",
    script: "scripts/tag-map-pipeline/stage-tag-normalize.ts",
  },
  {
    id: 3,
    name: "Stage 3 – Compound interpretation (LLM)",
    script: "scripts/tag-map-pipeline/stage-tag-compound.ts",
  },
  {
    id: 4,
    name: "Stage 4 – Postprocess tag compounds",
    script: "scripts/tag-map-pipeline/stage-tag-compound-postprocess.ts",
  },
  {
    id: 5,
    name: "Stage 5A – Style harvest",
    script: "scripts/tag-map-pipeline/stage-style-harvest.ts",
  },
  {
    id: 6,
    name: "Stage 5B – Style canonicalization (LLM)",
    script: "scripts/tag-map-pipeline/stage-style-canonical.ts",
  },
  {
    id: 7,
    name: "Stage 5C – Style hierarchy (LLM)",
    script: "scripts/tag-map-pipeline/stage-style-hierarchy.ts",
  },
  {
    id: 8,
    name: "Stage 5D – Final taxonomy + tag→style mapping",
    script: "scripts/tag-map-pipeline/stage-style-finalize.ts",
  },
  {
    id: 9,
    name: "Stage 6 – Final mapping (app-ready)",
    script: "scripts/tag-map-pipeline/stage-finalize-mapping.ts",
  },
];

// --------------------------
// CLI flag parsing
// --------------------------

const args = process.argv.slice(2);

function getFlagValue(flag: string): number | undefined {
  const idx = args.indexOf(flag);
  if (idx !== -1 && args[idx + 1]) return Number(args[idx + 1]);
  return undefined;
}

const from = getFlagValue("--from");
const to = getFlagValue("--to");

const minStage = from ?? 1;
const maxStage = to ?? stages.length;

// Validate
if (minStage < 1 || maxStage > stages.length || minStage > maxStage) {
  console.error("❌ Invalid --from / --to range.");
  console.error(`Valid range: 1 to ${stages.length}`);
  process.exit(1);
}

// --------------------------
// Run one stage
// --------------------------

function runStage(name: string, script: string) {
  console.log(`\n==============================`);
  console.log(`▶ Running stage: ${name}`);
  console.log(`   pnpm tsx ${script}`);
  console.log(`==============================\n`);

  const result = spawnSync("pnpm", ["tsx", script], {
    stdio: "inherit",
    cwd: path.join(__dirname, ".."), // project root
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    console.error(`❌ Stage failed: ${name}`);
    process.exit(result.status ?? 1);
  }

  console.log(`\n✅ Stage completed: ${name}\n`);
}

// --------------------------
// MAIN
// --------------------------

async function main() {
  console.log("🚀 Starting Tag-Map-Pipeline...");

  const selected = stages.filter(
    (s) => s.id >= minStage && s.id <= maxStage,
  );

  console.log(
    `🔧 Running stages ${minStage} → ${maxStage} (${selected.length} total)`
  );

  for (const stage of selected) {
    runStage(stage.name, stage.script);
  }

  console.log("\n🎉 All selected stages completed.\n");
}

void main();
