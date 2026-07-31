// Environment validation (BUILD-CONTRACT §4).
// LAZY by design: nothing throws at import/build time. Every secret is optional; the
// app degrades gracefully when values are missing. `env` validates on first access.

import { z } from "zod";
import {
  DEFAULT_MAP_ATTRIBUTION,
  DEFAULT_SITE_URL,
  RATE_LIMIT_MAX_DEFAULT,
  RATE_LIMIT_WINDOW_MS_DEFAULT,
} from "@/lib/constants";

const serverSchema = z.object({
  DATABASE_URL: z.string().min(1).optional(),

  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
  NEXT_PUBLIC_MAP_STYLE_URL: z.string().optional(),
  NEXT_PUBLIC_MAP_ATTRIBUTION: z.string().optional(),

  AUTH_SECRET: z.string().optional(),
  AUTH_GOOGLE_ID: z.string().optional(),
  AUTH_GOOGLE_SECRET: z.string().optional(),
  EMAIL_SERVER: z.string().optional(),
  EMAIL_FROM: z.string().optional(),

  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),

  ADMIN_EMAILS: z.string().optional(),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().optional(),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().optional(),
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | null = null;

function loadEnv(): ServerEnv {
  if (cached === null) {
    // All fields optional => this never throws during `next build`.
    cached = serverSchema.parse(process.env);
  }
  return cached;
}

/**
 * Validated server environment. Access is lazy: the schema is parsed on first
 * property read, never at import time.
 */
export const env: ServerEnv = new Proxy({} as ServerEnv, {
  get(_target, prop: string | symbol) {
    return loadEnv()[prop as keyof ServerEnv];
  },
});

/** Public (NEXT_PUBLIC_*) values only — safe to reference in client components. */
export const publicEnv = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_SITE_URL,
  mapStyleUrl: process.env.NEXT_PUBLIC_MAP_STYLE_URL ?? "",
  mapAttribution: process.env.NEXT_PUBLIC_MAP_ATTRIBUTION ?? DEFAULT_MAP_ATTRIBUTION,
} as const;

/** Feature-availability probes (read process.env directly; never throw). */
export function hasDb(): boolean {
  const v = process.env.DATABASE_URL;
  return typeof v === "string" && v.length > 0;
}

export function hasAuth(): boolean {
  const v = process.env.AUTH_SECRET;
  return typeof v === "string" && v.length > 0;
}

export function hasS3(): boolean {
  return (
    !!process.env.S3_ENDPOINT &&
    !!process.env.S3_BUCKET &&
    !!process.env.S3_ACCESS_KEY_ID &&
    !!process.env.S3_SECRET_ACCESS_KEY
  );
}

/** Rate-limit config resolved from env with contract defaults. */
export function rateLimitConfig(): { max: number; windowMs: number } {
  const max = Number(process.env.RATE_LIMIT_MAX);
  const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS);
  return {
    max: Number.isFinite(max) && max > 0 ? max : RATE_LIMIT_MAX_DEFAULT,
    windowMs: Number.isFinite(windowMs) && windowMs > 0 ? windowMs : RATE_LIMIT_WINDOW_MS_DEFAULT,
  };
}

/** Parsed, trimmed admin allow-list. */
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);
}
