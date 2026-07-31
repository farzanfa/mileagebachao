// In-memory token-bucket rate limiter (BUILD-CONTRACT §6, spec §7.5).
//
// Per-instance and best-effort: state lives in this process's memory only, so in a
// multi-instance deployment the real ceiling is `max * instances`. The production
// gateway enforces the authoritative IP/user token buckets described in the API spec;
// this limiter is a cheap backstop that also makes the routes self-contained for the
// zero-infrastructure build. No external store, no secrets, no import-time work.

import { rateLimitConfig } from "@/lib/env";

interface Bucket {
  /** Fractional tokens currently available. */
  tokens: number;
  /** Last refill timestamp (ms). */
  last: number;
  /** Bucket capacity this key was created with (for idle GC). */
  capacity: number;
}

const buckets = new Map<string, Bucket>();

// Opportunistic GC so a flood of distinct keys (e.g. per-IP) cannot grow the map
// without bound. Runs at most once per sweep interval, dropping buckets that have
// fully refilled and been idle for longer than the sweep window.
const GC_SWEEP_MS = 5 * 60_000;
const GC_MAP_THRESHOLD = 10_000;
let lastSweep = 0;

function sweep(now: number): void {
  if (now - lastSweep < GC_SWEEP_MS && buckets.size < GC_MAP_THRESHOLD) return;
  lastSweep = now;
  for (const [key, b] of buckets) {
    if (b.tokens >= b.capacity && now - b.last > GC_SWEEP_MS) {
      buckets.delete(key);
    }
  }
}

/**
 * Consume one token from `key`'s bucket.
 *
 * @param key       Identity to limit on (e.g. `"corrections:1.2.3.4"`).
 * @param max       Bucket capacity / tokens replenished per `windowMs`. Defaults to env RATE_LIMIT_MAX.
 * @param windowMs  Full-refill window in ms. Defaults to env RATE_LIMIT_WINDOW_MS.
 * @returns `ok` (was a token available), `remaining` (whole tokens left after this call),
 *          and `resetMs` (ms until the bucket is full again — usable as Retry-After when !ok).
 */
export function rateLimit(
  key: string,
  max?: number,
  windowMs?: number,
): { ok: boolean; remaining: number; resetMs: number } {
  const cfg = rateLimitConfig();
  const capacity = max !== undefined && max > 0 ? max : cfg.max;
  const window = windowMs !== undefined && windowMs > 0 ? windowMs : cfg.windowMs;
  const refillPerMs = capacity / window;

  const now = Date.now();
  sweep(now);

  let bucket = buckets.get(key);
  if (bucket === undefined) {
    bucket = { tokens: capacity, last: now, capacity };
    buckets.set(key, bucket);
  } else {
    // Refill based on elapsed time, capped at capacity.
    const elapsed = now - bucket.last;
    if (elapsed > 0) {
      bucket.tokens = Math.min(capacity, bucket.tokens + elapsed * refillPerMs);
      bucket.last = now;
    }
    // If capacity was changed by the caller, keep the bucket coherent.
    bucket.capacity = capacity;
  }

  let allowed: boolean;
  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    allowed = true;
  } else {
    allowed = false;
  }

  const deficit = capacity - bucket.tokens;
  const resetMs = refillPerMs > 0 ? Math.ceil(deficit / refillPerMs) : window;

  return { ok: allowed, remaining: Math.max(0, Math.floor(bucket.tokens)), resetMs };
}
