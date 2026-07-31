// GET /api/v1/admin/queue — moderation queue listing (AUTHMOD slice; BUILD-CONTRACT §7).
//
// Admin only: no session => 401 `unauthorized`; a valid non-admin session => 403 `forbidden`.
// Filters: `?type=` (correction|checkin|new_station) and `?status=` (pending|approved|rejected).
// Needs a DB, so a missing DATABASE_URL yields 503 `db_unavailable` (contract §2).

import { DbUnavailableError, err, ok, requireSession } from "@/lib/api";
import { listQueue } from "@/lib/queries/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const session = await requireSession(req);
  if (!session) {
    return err("unauthorized", "Sign in required.", 401);
  }
  if (!session.isAdmin) {
    return err("forbidden", "Admin access is required.", 403);
  }

  const url = new URL(req.url);
  const type = url.searchParams.get("type") ?? undefined;
  const status = url.searchParams.get("status") ?? undefined;

  try {
    const items = await listQueue({ type, status });
    return ok(items);
  } catch (e) {
    if (e instanceof DbUnavailableError) {
      return err("db_unavailable", "The moderation queue requires a configured database.", 503);
    }
    throw e;
  }
}
