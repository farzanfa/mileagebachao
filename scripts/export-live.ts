/**
 * scripts/export-live.ts — publish the database to the bundled dataset.
 *
 * The public map serves data/stations.seed.json (fast, SSG, zero DB reads).
 * Admin edits and approved community pumps land in Postgres first; this script
 * exports the DB back into the bundle. Publish flow:
 *
 *   DATABASE_URL=... npm run publish:data
 *   git add data/stations.seed.json && git commit && git push   (auto-deploys)
 *
 * The export uses the SAME read layer the API serves from (listStations), so
 * the bundle is exactly what production would read from the DB — grades, price,
 * provenance and all.
 */

import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { listStations } from "../src/lib/queries/stations";
import { getDb } from "../src/lib/db";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error("[export] DATABASE_URL is required (the DB is the source of truth to export).");
    process.exit(1);
  }
  const { rows, total } = await listStations({}, 5000, 0);
  rows.sort((a, b) => a.id.localeCompare(b.id)); // stable order => reviewable git diffs
  if (rows.length !== total) {
    console.error(`[export] paging bug: got ${rows.length} of ${total}`);
    process.exit(1);
  }
  if (rows.length < 100) {
    console.error(`[export] refusing to publish suspiciously small dataset (${rows.length} rows).`);
    process.exit(1);
  }
  // Excluded from the public bundle: closed + duplicate stations remain DB-only.
  const out = path.join(ROOT, "data", "stations.seed.json");
  await writeFile(out, JSON.stringify(rows, null, 1) + "\n", "utf8");
  console.log(`[export] wrote ${rows.length} stations -> ${path.relative(ROOT, out)}`);
  console.log("[export] next: git add data/stations.seed.json && git commit && git push (auto-deploys)");
  await getDb()?.end();
}

main().catch((e) => {
  console.error("[export] failed:", e);
  process.exit(1);
});
