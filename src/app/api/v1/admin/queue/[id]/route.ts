// POST /api/v1/admin/queue/:id — approve/reject a moderation item (AUTHMOD; BUILD-CONTRACT §7).
//
// Admin only: no session => 401 `unauthorized`; a valid non-admin session => 403 `forbidden`.
// Body: `{ decision: "approve" | "reject", note? }`. Needs a DB, so a missing DATABASE_URL
// yields 503 `db_unavailable` (contract §2). Unknown item id => 404 `not_found`.

import { DbUnavailableError, err, ok, requireSession } from "@/lib/api";
import { decideQueue } from "@/lib/queries/admin";
import { adminDecisionSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await requireSession(req);
  if (!session) {
    return err("unauthorized", "Sign in required.", 401);
  }
  if (!session.isAdmin) {
    return err("forbidden", "Admin access is required.", 403);
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return err("invalid_request", "Request body must be valid JSON.", 400);
  }

  const parsed = adminDecisionSchema.safeParse(body);
  if (!parsed.success) {
    return err("invalid_request", "Request validation failed.", 400, parsed.error.issues);
  }

  try {
    const result = await decideQueue(id, parsed.data.decision, parsed.data.note);
    return ok(result);
  } catch (e) {
    if (e instanceof DbUnavailableError) {
      return err("db_unavailable", "Moderation decisions require a configured database.", 503);
    }
    // decideQueue throws when the item id does not exist.
    if (e instanceof Error && e.message.includes("not found")) {
      return err("not_found", "Moderation item not found.", 404);
    }
    throw e;
  }
}
