// POST /api/v1/corrections — anonymous, rate-limited correction intake (BUILD-CONTRACT §7).
// Body: CorrectionInput. Success: 202 ApiOk<{ id }>. Writes require a DB: when
// DATABASE_URL is unset the request is validated then answered 503 db_unavailable.

import { DbUnavailableError, err, requestId } from "@/lib/api";
import { correctionSchema } from "@/lib/validation";
import { rateLimit } from "@/lib/ratelimit";
import { submitCorrection } from "@/lib/queries/corrections";
import { hasDb } from "@/lib/env";
import type { ApiErr, ApiOk, CorrectionInput } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Per-instance backstop for the anonymous write path (spec §7.5 caps anon reports
// at ~5/hour). The gateway enforces the authoritative limit + Turnstile.
const CORRECTIONS_MAX = 10;
const CORRECTIONS_WINDOW_MS = 60 * 60_000; // 1 hour

/** Best-effort client IP from proxy headers, for rate-limit keying. */
function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0];
    if (first && first.trim().length > 0) return first.trim();
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

export async function POST(req: Request): Promise<Response> {
  const rl = rateLimit(`corrections:${clientIp(req)}`, CORRECTIONS_MAX, CORRECTIONS_WINDOW_MS);
  if (!rl.ok) {
    const retryAfter = String(Math.ceil(rl.resetMs / 1000));
    const body: ApiErr = {
      error: {
        code: "rate_limited",
        message: "Too many corrections from this client. Please retry later.",
      },
      requestId: requestId(),
    };
    return new Response(JSON.stringify(body), {
      status: 429,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "retry-after": retryAfter,
        "ratelimit-remaining": "0",
        "ratelimit-reset": retryAfter,
      },
    });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return err("invalid_request", "Request body must be valid JSON.", 400);
  }

  const parsed = correctionSchema.safeParse(raw);
  if (!parsed.success) {
    return err("invalid_request", "Invalid correction payload.", 400, parsed.error.issues);
  }

  // Reads fall back to seed JSON, but writes are the DB's job (contract §2).
  if (!hasDb()) {
    return err("db_unavailable", "Corrections require a database, which is not configured.", 503);
  }

  const input: CorrectionInput = parsed.data;
  try {
    const result = await submitCorrection(input);
    const body: ApiOk<{ id: string }> = { data: result };
    return new Response(JSON.stringify(body), {
      status: 202,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  } catch (e) {
    if (e instanceof DbUnavailableError) {
      return err("db_unavailable", e.message, 503);
    }
    return err("internal_error", "Failed to submit correction.", 500);
  }
}
