// Shared domain types — the single source of truth (BUILD-CONTRACT §5).
// Everyone imports from "@/lib/types". Do not redefine these elsewhere.

export type Brand = "IOCL" | "HPCL" | "BPCL";
export type GradeName = "XP100" | "poWer 100" | "Speed 100" | "poWer 99" | "Speed 97";
export type Availability = "in_stock" | "out_of_stock" | "unknown";
export type VerificationStatus = "official-listed" | "field-verified" | "stale";
export type FreshnessKey = "fresh" | "likely" | "stale" | "dry" | "unverified";
export type SortKey = "dist" | "fresh";

export interface GradeMeta {
  name: GradeName;
  brand: Brand;
  ron: number;
  e0: boolean | null;
  legacy: boolean;
  full: string;
}
export interface BrandMeta {
  id: Brand;
  name: string;
  colorVar: string;
} // colorVar e.g. "--brand-iocl"
export interface OriginCity {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

export interface ProvenanceRef {
  source: string;
  license: string;
  retrievedAt: string;
  method: string;
}
export interface StationGrade {
  grade: GradeName;
  availability: Availability;
  lastVerifiedDays: number | null; // null => never field-verified
  checkins: number;
  status: VerificationStatus;
}
export interface Price {
  grade: GradeName;
  value: string;
  currency: "INR";
  source: string;
  asOf: string;
}

export interface Station {
  id: string; // stable id, e.g. "iocl-dl-0421"
  slug: string; // url slug, e.g. "connaught-place-indianoil"
  name: string;
  brand: Brand;
  city: string;
  citySlug: string; // e.g. "delhi"
  state: string;
  pincode: string;
  lat: number;
  lng: number;
  roCode: string;
  address: string;
  phone: string | null;
  grades: StationGrade[];
  price: Price | null;
  sources: ProvenanceRef[];
  firstSeen: string; // ISO date
  lastVerified: string | null; // ISO date; moved ONLY by a check-in
}
export interface StationWithDistance extends Station {
  distanceKm: number;
}

export interface Coord {
  lat: number;
  lng: number;
}
export interface Bounds {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
}

export interface FilterState {
  grades: Record<GradeName, boolean>;
  brands: Record<Brand, boolean>;
  e0Only: boolean;
  query: string;
  originId: string;
  sort: SortKey;
}

// API envelope
export interface ApiMeta {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}
export interface ApiOk<T> {
  data: T;
  meta?: ApiMeta;
}
export interface ApiErr {
  error: { code: string; message: string; details?: unknown };
  requestId: string;
}

// write payloads
export interface CorrectionInput {
  stationId: string;
  field: string;
  value: string;
  note?: string;
  contact?: string;
}
export interface CheckinInput {
  stationId: string;
  grade: GradeName;
  result: "in_stock" | "out_of_stock" | "not_stocked";
  lat?: number;
  lng?: number;
}
