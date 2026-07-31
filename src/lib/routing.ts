// In-app driving routes via OSRM (Open Source Routing Machine).
// Default backend is the public demo server (fine for development and light use —
// see https://github.com/Project-OSRM/osrm-backend/wiki/Demo-server for its policy).
// For production scale, self-host OSRM or point NEXT_PUBLIC_ROUTING_URL at a paid
// engine with the same /route/v1/driving API (OpenRouteService, GraphHopper, etc.).
// Client-safe: plain fetch, no keys, coordinates never persisted anywhere.

import type { Coord } from "@/lib/types";

export interface RouteResult {
  distanceKm: number;
  durationMin: number;
  /** Road geometry as [lng, lat] pairs (GeoJSON order), ready for a map line layer. */
  geometry: [number, number][];
}

const DEFAULT_OSRM = "https://router.project-osrm.org";

function base(): string {
  return (process.env.NEXT_PUBLIC_ROUTING_URL || DEFAULT_OSRM).replace(/\/+$/, "");
}

interface OsrmRoute {
  distance: number;
  duration: number;
  geometry: { type: "LineString"; coordinates: [number, number][] };
}

/** Fetch a driving route; resolves null on any failure (callers degrade gracefully). */
export async function fetchRoute(from: Coord, to: Coord): Promise<RouteResult | null> {
  const url =
    `${base()}/route/v1/driving/` +
    `${from.lng.toFixed(6)},${from.lat.toFixed(6)};${to.lng.toFixed(6)},${to.lat.toFixed(6)}` +
    `?overview=full&geometries=geojson&alternatives=false&steps=false`;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12_000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const body = (await res.json()) as { code?: string; routes?: OsrmRoute[] };
    const route = body.code === "Ok" ? body.routes?.[0] : undefined;
    if (!route || !route.geometry?.coordinates?.length) return null;
    return {
      distanceKm: route.distance / 1000,
      durationMin: Math.max(1, Math.round(route.duration / 60)),
      geometry: route.geometry.coordinates,
    };
  } catch {
    return null;
  }
}
