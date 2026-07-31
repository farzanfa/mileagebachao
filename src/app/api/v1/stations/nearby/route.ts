// GET /api/v1/stations/nearby — distance-sorted stations near a point (BUILD-CONTRACT §7).
// Public read; falls back to seed JSON when no DB is configured (via the query layer).
// Returns ApiOk<StationWithDistance[]> (distance ascending, straight-line/aerial).

import { err, ok } from "@/lib/api";
import { nearbyQuerySchema } from "@/lib/validation";
import { nearbyStations } from "@/lib/queries/nearby";
import type { StationFilter } from "@/lib/queries/stations";
import type { Coord } from "@/lib/types";
import { NEARBY_RADIUS_DEFAULT_KM, PAGE_LIMIT_DEFAULT } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// spec §7.6: nearby is distance-sorted and uncursored — hard-cap the result count.
const NEARBY_LIMIT_MAX = 50;

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const parsed = nearbyQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return err("invalid_request", "Invalid query parameters.", 400, parsed.error.issues);
  }
  const q = parsed.data;

  const center: Coord = { lat: q.lat, lng: q.lng };
  const radiusKm = q.radiusKm ?? NEARBY_RADIUS_DEFAULT_KM;
  const limit = Math.min(q.limit ?? PAGE_LIMIT_DEFAULT, NEARBY_LIMIT_MAX);

  const filter: StationFilter = {};
  if (q.grade && q.grade.length > 0) filter.grades = q.grade;
  if (q.brand && q.brand.length > 0) filter.brands = q.brand;
  if (q.e0Only !== undefined) filter.e0Only = q.e0Only;

  try {
    const rows = await nearbyStations(center, radiusKm, filter, limit);
    return ok(rows);
  } catch {
    return err("internal_error", "Failed to search nearby stations.", 500);
  }
}
