// GET /api/v1/health — liveness + DB-configuration probe (BUILD-CONTRACT §7).
// Response: { data: { status: "ok", db: boolean, ts: string } }

import { ok } from "@/lib/api";
import { hasDb } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(): Response {
  return ok({
    status: "ok" as const,
    db: hasDb(),
    ts: new Date().toISOString(),
  });
}
