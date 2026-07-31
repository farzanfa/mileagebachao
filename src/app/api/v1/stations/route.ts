// GET /api/v1/stations — filtered, paginated station search (BUILD-CONTRACT §7).
// Public read; falls back to seed JSON when no DB is configured (via the query layer).
// Returns ApiOk<Station[]> + meta { total, limit, offset, hasMore }.

import { err, ok, parsePaging } from "@/lib/api";
import { stationsQuerySchema } from "@/lib/validation";
import { listStations, type StationFilter } from "@/lib/queries/stations";
import { bestFreshness } from "@/lib/freshness";
import type { ApiMeta, FreshnessKey, Station } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Higher rank = fresher; used to order the page when sort=fresh (mirrors the
// prototype's freshness ranking so the freshest stations surface first).
const FRESH_RANK: Record<FreshnessKey, number> = {
  fresh: 0,
  likely: 1,
  stale: 2,
  dry: 3,
  unverified: 4,
};

function sortByFreshness(rows: Station[]): Station[] {
  return [...rows].sort((a, b) => FRESH_RANK[bestFreshness(a).key] - FRESH_RANK[bestFreshness(b).key]);
}

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const parsed = stationsQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return err("invalid_request", "Invalid query parameters.", 400, parsed.error.issues);
  }
  const q = parsed.data;

  const filter: StationFilter = {};
  if (q.q) filter.query = q.q;
  if (q.grade && q.grade.length > 0) filter.grades = q.grade;
  if (q.brand && q.brand.length > 0) filter.brands = q.brand;
  if (q.e0Only !== undefined) filter.e0Only = q.e0Only;

  const { limit, offset } = parsePaging(url);

  try {
    const { rows, total } = await listStations(filter, limit, offset);
    // sort=fresh reorders the returned page (best-effort; the corpus is small enough
    // that a page typically covers the full result set). sort=dist has no meaning
    // without an origin coordinate — use /stations/nearby for distance ordering.
    const data = q.sort === "fresh" ? sortByFreshness(rows) : rows;
    const meta: ApiMeta = { total, limit, offset, hasMore: offset + rows.length < total };
    return ok(data, meta);
  } catch {
    return err("internal_error", "Failed to list stations.", 500);
  }
}
