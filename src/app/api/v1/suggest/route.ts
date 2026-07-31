// POST /api/v1/suggest — anonymous, rate-limited "add a pump" intake.
// Anyone who finds a pump selling XP100 / poWer 100 / Speed 100 (or the legacy 99/97
// grades) can report it. Entries land in the moderation queue as kind 'new_station'
// and only appear on the map after review. Same envelope + degradation rules as
// /corrections: validated first, 503 db_unavailable when no database is configured.

import { z } from "zod";

import { DbUnavailableError, err, requestId } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { submitNewStation } from "@/lib/queries/corrections";
import { hasDb } from "@/lib/env";
import type { ApiErr, ApiOk } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUGGEST_MAX = 10;
const SUGGEST_WINDOW_MS = 60 * 60_000; // 1 hour

const suggestSchema = z.object({
  fuel: z.enum(["XP100", "poWer 100", "Speed 100", "poWer 99", "Speed 97", "Not sure"]),
  pumpName: z.string().trim().min(3).max(120),
  city: z.string().trim().min(2).max(80),
  area: z.string().trim().max(120).optional(),
  state: z.string().trim().min(2).max(60),
  note: z.string().trim().max(500).optional(),
  contact: z.string().trim().max(120).optional(),
});

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0];
    if (first && first.trim().length > 0) return first.trim();
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

export async function POST(req: Request): Promise<Response> {
  const rl = rateLimit(`suggest:${clientIp(req)}`, SUGGEST_MAX, SUGGEST_WINDOW_MS);
  if (!rl.ok) {
    const retryAfter = String(Math.ceil(rl.resetMs / 1000));
    const body: ApiErr = {
      error: {
        code: "rate_limited",
        message: "Too many submissions from this client. Please retry later.",
      },
      requestId: requestId(),
    };
    return new Response(JSON.stringify(body), {
      status: 429,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "retry-after": retryAfter,
      },
    });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return err("invalid_request", "Request body must be valid JSON.", 400);
  }

  const parsed = suggestSchema.safeParse(raw);
  if (!parsed.success) {
    return err("invalid_request", "Invalid pump suggestion.", 400, parsed.error.issues);
  }

  if (!hasDb()) {
    return err(
      "db_unavailable",
      "Pump submissions require a database, which is not configured on this deployment.",
      503,
    );
  }

  try {
    const result = await submitNewStation(parsed.data);
    const body: ApiOk<{ id: string }> = { data: result };
    return new Response(JSON.stringify(body), {
      status: 202,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  } catch (e) {
    if (e instanceof DbUnavailableError) {
      return err("db_unavailable", e.message, 503);
    }
    return err("internal_error", "Failed to submit the pump suggestion.", 500);
  }
}
