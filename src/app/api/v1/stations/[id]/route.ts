// GET /api/v1/stations/:id — full station detail (BUILD-CONTRACT §7).
// Public read; falls back to seed JSON when no DB is configured (via the query layer).
// Returns ApiOk<Station> | 404 { code: "not_found" }.

import { err, ok } from "@/lib/api";
import { getStation } from "@/lib/queries/stations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params;
  if (!id) {
    return err("invalid_request", "Station id is required.", 400);
  }
  try {
    const station = await getStation(id);
    if (station === null) {
      return err("not_found", `No station with id "${id}".`, 404);
    }
    return ok(station);
  } catch {
    return err("internal_error", "Failed to load station.", 500);
  }
}
