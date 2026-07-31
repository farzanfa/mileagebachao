// Build-time & fallback read source (BUILD-CONTRACT §6, §2, §10).
// Reads the committed reference/seed JSON. Never touches the database — this is what
// makes `next build`, SSG and the read-only app work with zero infrastructure.

import type { BrandMeta, GradeMeta, OriginCity, Station } from "@/lib/types";

import brandsRaw from "../../data/brands.json";
import gradesRaw from "../../data/grades.json";
import originsRaw from "../../data/origins.json";
import stationsRaw from "../../data/stations.seed.json";

// JSON is imported as inferred literals; cast through unknown to the contract types.
const STATIONS = stationsRaw as unknown as Station[];
const GRADES = gradesRaw as unknown as GradeMeta[];
const BRANDS = brandsRaw as unknown as BrandMeta[];
const ORIGINS = originsRaw as unknown as OriginCity[];

/** All seed stations (read-only reference dataset). */
export function allStations(): Station[] {
  return STATIONS;
}

/** Grade metadata keyed by grade name. */
export function gradeMeta(): Record<GradeMeta["name"], GradeMeta> {
  const out = {} as Record<GradeMeta["name"], GradeMeta>;
  for (const g of GRADES) {
    out[g.name] = g;
  }
  return out;
}

/** Brand metadata keyed by brand id. */
export function brandMeta(): Record<BrandMeta["id"], BrandMeta> {
  const out = {} as Record<BrandMeta["id"], BrandMeta>;
  for (const b of BRANDS) {
    out[b.id] = b;
  }
  return out;
}

/** Origin cities used for "near me" distance sorting. */
export function origins(): OriginCity[] {
  return ORIGINS;
}

/** Look up a single station by its stable id. */
export function stationById(id: string): Station | undefined {
  return STATIONS.find((s) => s.id === id);
}

/** Distinct cities with station counts, sorted by count desc then name. */
export function cities(): { slug: string; name: string; state: string; count: number }[] {
  const map = new Map<string, { slug: string; name: string; state: string; count: number }>();
  for (const s of STATIONS) {
    const existing = map.get(s.citySlug);
    if (existing) {
      existing.count += 1;
    } else {
      map.set(s.citySlug, { slug: s.citySlug, name: s.city, state: s.state, count: 1 });
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}
