/**
 * scripts/migrate.ts — run migrations/*.sql in filename order via postgres.js.
 * (BUILD-CONTRACT §1 `npm run migrate`, spec §6.16.)
 *
 * Idempotent: applied versions are tracked in public.schema_migrations; already-applied files are
 * skipped. Each file runs inside a single transaction (whole-file simple-protocol execution, so
 * dollar-quoted function bodies stay intact) and is recorded atomically. Forward-only.
 *
 * Requires DATABASE_URL. This is an ops script — it never runs during `next build`.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import postgres from "postgres";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(HERE, "..", "migrations");

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("[migrate] DATABASE_URL is not set — nothing to migrate.");
    process.exit(1);
  }

  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS public.schema_migrations (
        version    text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )`;

    const files = (await readdir(MIGRATIONS_DIR))
      .filter((f) => f.endsWith(".sql"))
      .sort((a, b) => a.localeCompare(b));

    const appliedRows = await sql<{ version: string }[]>`SELECT version FROM public.schema_migrations`;
    const applied = new Set<string>(appliedRows.map((r) => r.version));

    let ran = 0;
    for (const file of files) {
      if (applied.has(file)) {
        console.log(`[migrate] skip  ${file}`);
        continue;
      }
      const contents = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
      console.log(`[migrate] apply ${file}`);
      await sql.begin(async (tx) => {
        await tx.unsafe(contents);
        await tx`INSERT INTO public.schema_migrations (version) VALUES (${file})`;
      });
      ran += 1;
    }

    console.log(`[migrate] done: ${ran} applied, ${files.length - ran} skipped.`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err: unknown) => {
  console.error("[migrate] failed:", err);
  process.exit(1);
});
