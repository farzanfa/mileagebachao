// Lazy postgres.js singleton (BUILD-CONTRACT §6, §2).
// getDb() returns null when DATABASE_URL is unset so that `next build`, SSG and the
// read-only app run with zero infrastructure (reads fall back to seed JSON via data.ts).
// Nothing here connects at import time.

import postgres from "postgres";

let cached: ReturnType<typeof postgres> | null = null;
let initialized = false;

function dbUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  return url && url.length > 0 ? url : undefined;
}

/** Whether a database connection string is configured. */
export function hasDb(): boolean {
  return dbUrl() !== undefined;
}

/**
 * Lazily create (once) and return the postgres.js client, or null when no
 * DATABASE_URL is configured. Callers that require a DB should treat null as
 * "database unavailable" and surface the 503 db_unavailable envelope.
 */
export function getDb(): ReturnType<typeof postgres> | null {
  const url = dbUrl();
  if (!url) return null;
  if (!initialized) {
    cached = postgres(url, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: true,
    });
    initialized = true;
  }
  return cached;
}
