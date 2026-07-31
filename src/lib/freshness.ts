// Freshness + reliability model (BUILD-CONTRACT §6).
// Ported verbatim in behaviour from the prototype's gradeState / reliability /
// stationAllUnverified / relDays / pinFresh logic.

import type { FreshnessKey, GradeName, Station, StationGrade } from "@/lib/types";
import {
  DRY_WINDOW_DAYS,
  FIELD_VERIFIED_MAX_DAYS,
  FRESH_MAX_DAYS,
  RELIABILITY_CONFIRMATION_TARGET,
  RELIABILITY_CONFIRMATION_WEIGHT,
  RELIABILITY_RECENCY_HORIZON_DAYS,
  RELIABILITY_RECENCY_WEIGHT,
  RELIABILITY_UNVERIFIED,
} from "@/lib/constants";

export interface FreshnessInfo {
  key: FreshnessKey;
  label: string;
  colorVar: string; // colorVar e.g. "--fresh"
}

// Rank used to pick the "best" freshness across a station's visible grades
// (prototype pinFresh: fresh 4, likely 3, stale 2, dry 1, unverified 0).
const FRESHNESS_RANK: Record<FreshnessKey, number> = {
  fresh: 4,
  likely: 3,
  stale: 2,
  dry: 1,
  unverified: 0,
};

const UNVERIFIED: FreshnessInfo = {
  key: "unverified",
  label: "Unverified",
  colorVar: "--unknown",
};

/**
 * Classify a single grade's freshness. Mirrors the prototype gradeState():
 *  - reported dry within the dry window   => "dry"      (--dry)
 *  - never field-verified (days === null) => "unverified" (--unknown)
 *  - in stock & verified <= 14d           => "fresh"    (--fresh)
 *  - verified <= 30d                      => "likely"   (--stale)
 *  - otherwise                            => "stale"    (--stale)
 */
export function gradeFreshness(g: StationGrade): FreshnessInfo {
  const d = g.lastVerifiedDays;

  if (g.availability === "out_of_stock" && d !== null && d <= DRY_WINDOW_DAYS) {
    return { key: "dry", label: "Reported dry", colorVar: "--dry" };
  }
  if (d === null) {
    return UNVERIFIED;
  }
  if (g.availability === "in_stock" && d <= FRESH_MAX_DAYS) {
    return { key: "fresh", label: "In stock", colorVar: "--fresh" };
  }
  if (d <= FIELD_VERIFIED_MAX_DAYS) {
    return { key: "likely", label: `Likely (${d}d ago)`, colorVar: "--stale" };
  }
  return { key: "stale", label: `Stale (${d}d)`, colorVar: "--stale" };
}

/**
 * Confidence 0..100 from recency + number of confirming check-ins.
 * Ported from the prototype reliability().
 */
export function reliabilityScore(g: StationGrade): number {
  const d = g.lastVerifiedDays;
  if (d === null) return RELIABILITY_UNVERIFIED;
  const recency = Math.max(0, 1 - d / RELIABILITY_RECENCY_HORIZON_DAYS);
  const confirmation = Math.min(1, g.checkins / RELIABILITY_CONFIRMATION_TARGET);
  return Math.round(
    (recency * RELIABILITY_RECENCY_WEIGHT + confirmation * RELIABILITY_CONFIRMATION_WEIGHT) * 100,
  );
}

/** True when no grade at the station has ever been field-verified. */
export function stationIsAllUnverified(s: Station): boolean {
  return s.grades.every((g) => g.lastVerifiedDays === null);
}

/** Human "how long ago" label. Ported from the prototype relDays(). */
export function relDays(days: number | null): string {
  if (days === null) return "never field-verified";
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

/**
 * Best (freshest) status across a station's grades, optionally restricted to a
 * set of currently-visible grade names. Ported from the prototype pinFresh().
 */
export function bestFreshness(s: Station, visibleGrades?: GradeName[]): FreshnessInfo {
  const grades = visibleGrades
    ? s.grades.filter((g) => visibleGrades.includes(g.grade))
    : s.grades;

  let best: FreshnessInfo = UNVERIFIED;
  for (const g of grades) {
    const info = gradeFreshness(g);
    if (FRESHNESS_RANK[info.key] >= FRESHNESS_RANK[best.key]) {
      best = info;
    }
  }
  return best;
}
