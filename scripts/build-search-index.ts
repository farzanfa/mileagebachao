// Prebuild the MiniSearch index from the committed seed dataset (BUILD-CONTRACT §1,
// §6; `npm run build:index`). Writes a serialised index JSON next to the seed so the
// client can rehydrate it via MiniSearch.loadJSON with the options in src/lib/search.ts
// instead of re-tokenising on every page load. Node script (tsx); no DB, no secrets.
//
// The type-only `Station` import is erased at runtime, so this script only needs
// `minisearch` (via src/lib/search) and the Node builtins.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { buildIndex } from "../src/lib/search";
import type { Station } from "../src/lib/types";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..");
const seedPath = join(repoRoot, "data", "stations.seed.json");
const outPath = join(repoRoot, "data", "search-index.json");

function main(): void {
  const raw = readFileSync(seedPath, "utf8");
  const stations = JSON.parse(raw) as Station[];

  const index = buildIndex(stations);
  // MiniSearch implements toJSON(), so JSON.stringify serialises the full index.
  writeFileSync(outPath, JSON.stringify(index), "utf8");

  process.stdout.write(
    `build-search-index: wrote ${outPath} (${stations.length} stations indexed)\n`,
  );
}

main();
