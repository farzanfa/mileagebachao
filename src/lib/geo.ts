// Geospatial + slug helpers (BUILD-CONTRACT §6).

import type { Coord } from "@/lib/types";

const EARTH_RADIUS_KM = 6371;

// Unicode combining diacritical marks (U+0300–U+036F). Built via RegExp() so the
// source file stays pure ASCII.
const COMBINING_MARKS = new RegExp("[\\u0300-\\u036f]", "g");

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Great-circle distance in kilometres between two coordinates (haversine).
 * Ported from the prototype's `haversine`.
 */
export function haversineKm(a: Coord, b: Coord): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const s =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

/**
 * URL-safe slug: lowercase, ASCII-fold common diacritics, non-alphanumerics to
 * single hyphens, trimmed. e.g. "Connaught Place, IndianOil" -> "connaught-place-indianoil".
 */
export function toSlug(input: string): string {
  return input
    .normalize("NFKD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
