// Shared, dependency-free constants (BUILD-CONTRACT §11 FOUNDATION).
// Imported across slices; keep values coherent with the contract and prototype.

import type { Brand, GradeName } from "@/lib/types";

// --- Brand identity ---
export const SITE_NAME = "MileageBachao" as const;
export const SITE_TAGLINE = "Mileage bachao, E0 bharao." as const;
// Brand voice: campaign-parody name, professional execution. E20 costs you mileage;
// the map finds the only legal ethanol-free (E0) petrol — the 100-octane grades.
export const SITE_DESCRIPTION =
  "E20 eating your mileage? MileageBachao is the map of India's ethanol-free (E0), " +
  "100-octane petrol pumps — IndianOil XP100, HP poWer 100 and Bharat Petroleum Speed 100. " +
  "Find genuine E0 petrol near you, or add a pump you found.";

export const DEFAULT_MAP_ATTRIBUTION = "© OpenStreetMap contributors" as const;
export const DEFAULT_SITE_URL = "http://localhost:3000" as const;

// --- Grades ---
export const PRIMARY_GRADES: readonly GradeName[] = ["XP100", "poWer 100", "Speed 100"] as const;
export const LEGACY_GRADES: readonly GradeName[] = ["poWer 99", "Speed 97"] as const;
export const ALL_GRADES: readonly GradeName[] = [...PRIMARY_GRADES, ...LEGACY_GRADES];
export const ALL_BRANDS: readonly Brand[] = ["IOCL", "HPCL", "BPCL"] as const;

// --- Freshness / verification thresholds (ported from the prototype gradeState) ---
export const FRESH_MAX_DAYS = 14; // "in stock, verified <= 14d" => fresh
export const FIELD_VERIFIED_MAX_DAYS = 30; // <= 30d => field-verified; > 30d => stale
export const DRY_WINDOW_DAYS = 21; // a "dry" report counts while <= 21d old

// --- Reliability score weighting (0..100) ---
export const RELIABILITY_UNVERIFIED = 12;
export const RELIABILITY_RECENCY_HORIZON_DAYS = 45;
export const RELIABILITY_CONFIRMATION_TARGET = 10; // check-ins to saturate confidence
export const RELIABILITY_RECENCY_WEIGHT = 0.7;
export const RELIABILITY_CONFIRMATION_WEIGHT = 0.3;

// --- Paging (API) ---
export const PAGE_LIMIT_DEFAULT = 20;
export const PAGE_LIMIT_MAX = 100;
export const PAGE_OFFSET_MAX = 100_000;

// --- Nearby search ---
export const NEARBY_RADIUS_DEFAULT_KM = 25;
export const NEARBY_RADIUS_MAX_KM = 200;

// --- Check-in geofence (a check-in must be physically near the station) ---
export const CHECKIN_GEOFENCE_KM = 1;

// --- Rate limiting defaults (overridable via env RATE_LIMIT_*) ---
export const RATE_LIMIT_MAX_DEFAULT = 60;
export const RATE_LIMIT_WINDOW_MS_DEFAULT = 60_000;

// --- Authoritative price (only Speed 100 carries a price in seed data, memo §0) ---
export const AUTHORITATIVE_PRICE_GRADE: GradeName = "Speed 100";

// --- Reference "today" used when deriving relative dates from the seed ---
export const SEED_REFERENCE_DATE = "2026-07-30" as const;
