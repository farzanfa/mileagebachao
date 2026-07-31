// POST /api/v1/checkins — three-tap community check-in (AUTHMOD slice; BUILD-CONTRACT §7).
//
// Auth required (401 `unauthorized`). Geofenced: the device coordinates must be near the
// station (contract §7; "the only event that moves last_verified"). Returns 201 with the new
// report id + the timestamp last_verified moved to. Writes need a DB, so a missing DATABASE_URL
// yields 503 `db_unavailable` (contract §2).

import { DbUnavailableError, err, requireSession } from "@/lib/api";
import { CHECKIN_GEOFENCE_KM } from "@/lib/constants";
import { haversineKm } from "@/lib/geo";
import { recordCheckin } from "@/lib/queries/checkins";
import { getStation } from "@/lib/queries/stations";
import type { ApiOk, CheckinInput } from "@/lib/types";
import { checkinSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 201 Created with the §5 success envelope. `ok()` from @/lib/api is fixed at 200, so a check-in
// (contract §7: "201 ApiOk<...>") is emitted directly with the same shape.
function created<T>(data: T): Response {
  const body: ApiOk<T> = { data };
  return new Response(JSON.stringify(body), {
    status: 201,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export async function POST(req: Request): Promise<Response> {
  const session = await requireSession(req);
  if (!session) {
    return err("unauthorized", "You must be signed in to check in.", 401);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return err("invalid_request", "Request body must be valid JSON.", 400);
  }

  const parsed = checkinSchema.safeParse(body);
  if (!parsed.success) {
    return err("invalid_request", "Request validation failed.", 400, parsed.error.issues);
  }
  const input: CheckinInput = parsed.data;

  // Geofence: a three-tap check-in happens at the pump, so device coordinates are required and
  // must fall within CHECKIN_GEOFENCE_KM of the station (the shared FOUNDATION constant; the
  // ~200 m guideline is subsumed by it). Raw coordinates are used only here and never persisted
  // (DPDP minimization, memo D.5).
  if (input.lat == null || input.lng == null) {
    return err(
      "location_required",
      "Your location is required to check in at a station.",
      422,
    );
  }

  const station = await getStation(input.stationId);
  if (!station) {
    return err("not_found", "Station not found.", 404);
  }

  const distanceKm = haversineKm(
    { lat: station.lat, lng: station.lng },
    { lat: input.lat, lng: input.lng },
  );
  if (distanceKm > CHECKIN_GEOFENCE_KM) {
    return err(
      "too_far_from_station",
      `You appear to be ${distanceKm.toFixed(1)} km away; check in from the station.`,
      422,
      { distanceKm: Number(distanceKm.toFixed(3)), geofenceKm: CHECKIN_GEOFENCE_KM },
    );
  }

  try {
    const result = await recordCheckin(input, session.email);
    return created(result);
  } catch (e) {
    if (e instanceof DbUnavailableError) {
      return err("db_unavailable", "Check-ins require a configured database.", 503);
    }
    throw e;
  }
}
