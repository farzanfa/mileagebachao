// Request validation — one zod schema per endpoint (BUILD-CONTRACT §6/§7).
//
// Query schemas accept the raw string map from `URLSearchParams` (via
// Object.fromEntries) and coerce/transform into typed filter values. Body schemas
// validate parsed JSON. On failure the route returns `400 invalid_request` with
// `error.details` set to `zodError.issues`.
//
// Grade/brand CSV params are lenient: unrecognized tokens are dropped rather than
// rejected, so a future grade added upstream never 400s an older client (spec §7.3
// enum-evolution contract). Scalar params (sort, e0_only, numbers) are strict.

import { z } from "zod";
import type { Brand, GradeName } from "@/lib/types";
import { NEARBY_RADIUS_MAX_KM } from "@/lib/constants";

// Literal tuples mirror the GradeName / Brand unions in @/lib/types. z.enum needs a
// literal tuple; keeping these here (not importing the readonly arrays from
// constants) preserves exact literal inference so z.infer === GradeName / Brand.
const GRADE_VALUES = ["XP100", "poWer 100", "Speed 100", "poWer 99", "Speed 97"] as const;
const BRAND_VALUES = ["IOCL", "HPCL", "BPCL"] as const;

const gradeEnum = z.enum(GRADE_VALUES);

/** Boolean-ish query flag: "true"/"1" => true, "false"/"0" => false. */
const boolFlag = z
  .enum(["true", "false", "1", "0"])
  .transform((v) => v === "true" || v === "1")
  .optional();

/** CSV of grade names; unknown tokens are silently dropped (see file header). */
const gradesCsv = z
  .string()
  .transform((s): GradeName[] =>
    s
      .split(",")
      .map((p) => p.trim())
      .filter((p): p is GradeName => (GRADE_VALUES as readonly string[]).includes(p)),
  )
  .optional();

/** CSV of brand ids; unknown tokens are silently dropped. */
const brandsCsv = z
  .string()
  .transform((s): Brand[] =>
    s
      .split(",")
      .map((p) => p.trim())
      .filter((p): p is Brand => (BRAND_VALUES as readonly string[]).includes(p)),
  )
  .optional();

// `limit`/`offset` are intentionally NOT validated here — paging on /stations is
// owned by parsePaging() (@/lib/api), which clamps to safe bounds rather than 400ing.
// zod .object() strips these (and any other unknown params) without erroring.
/** `GET /v1/stations` query params. */
export const stationsQuerySchema = z.object({
  q: z.string().trim().max(160).optional(),
  grade: gradesCsv,
  brand: brandsCsv,
  e0Only: boolFlag,
  sort: z.enum(["dist", "fresh"]).optional(),
});

/** `GET /v1/stations/nearby` query params. `limit` is clamped in the route (max 50). */
export const nearbyQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radiusKm: z.coerce.number().positive().max(NEARBY_RADIUS_MAX_KM).optional(),
  grade: gradesCsv,
  brand: brandsCsv,
  e0Only: boolFlag,
  limit: z.coerce.number().int().min(1).optional(),
});

/** `POST /v1/corrections` body (CorrectionInput). */
export const correctionSchema = z.object({
  stationId: z.string().trim().min(1).max(64),
  field: z.string().trim().min(1).max(64),
  value: z.string().trim().min(1).max(500),
  note: z.string().trim().max(1000).optional(),
  contact: z.string().trim().max(200).optional(),
});

/** `POST /v1/checkins` body (CheckinInput) — consumed by AUTHMOD's route. */
export const checkinSchema = z.object({
  stationId: z.string().trim().min(1).max(64),
  grade: gradeEnum,
  result: z.enum(["in_stock", "out_of_stock", "not_stocked"]),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

/** `POST /v1/images` body — presigned-upload declaration. */
export const imagePresignSchema = z.object({
  stationId: z.string().trim().min(1).max(64),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp", "image/heic"]),
});

/** `POST /v1/admin/queue/:id` body — consumed by AUTHMOD's route. */
export const adminDecisionSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  note: z.string().trim().max(1000).optional(),
});

export type StationsQuery = z.infer<typeof stationsQuerySchema>;
export type NearbyQuery = z.infer<typeof nearbyQuerySchema>;
export type CorrectionBody = z.infer<typeof correctionSchema>;
export type CheckinBody = z.infer<typeof checkinSchema>;
export type ImagePresignBody = z.infer<typeof imagePresignSchema>;
export type AdminDecisionBody = z.infer<typeof adminDecisionSchema>;
