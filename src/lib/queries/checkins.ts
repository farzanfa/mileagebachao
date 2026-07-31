// Check-in write query (AUTHMOD slice; BUILD-CONTRACT §6, §11).
//
// A check-in is the ONLY event that moves `last_verified` (contract §5, memo C.10). It is
// recorded as an append-only `verification_history` event; the DB projection trigger
// (trg_apply_verification, final-database.md §6.9) applies the outcome to `station_fuels`
// and stamps `last_verified_at` + the recency-weighted availability score.
//
// Requires a database: throws DbUnavailableError when DATABASE_URL is unset so the write
// route can surface the standard 503 `db_unavailable` envelope (contract §2).

import { DbUnavailableError } from "@/lib/api";
import { getDb } from "@/lib/db";
import type { CheckinInput, GradeName } from "@/lib/types";

// GradeName (display) -> fuel_types.code (final-database.md §6.5).
const FUEL_CODE: Record<GradeName, string> = {
  XP100: "XP100",
  "poWer 100": "POWER100",
  "Speed 100": "SPEED100",
  "poWer 99": "POWER99",
  "Speed 97": "SPEED97",
};

interface CheckinProjection {
  reportKind: "availability_checkin" | "fuel_removed";
  availability: "available" | "out_of_stock" | null;
  outcome: "confirmed_available" | "confirmed_out_of_stock" | null;
  status: "auto_approved" | "pending";
}

// Map the three-tap result (memo D.10) onto the report/verification enums.
function project(result: CheckinInput["result"]): CheckinProjection {
  switch (result) {
    case "in_stock":
      return {
        reportKind: "availability_checkin",
        availability: "available",
        outcome: "confirmed_available",
        status: "auto_approved",
      };
    case "out_of_stock":
      return {
        reportKind: "availability_checkin",
        availability: "out_of_stock",
        outcome: "confirmed_out_of_stock",
        status: "auto_approved",
      };
    case "not_stocked":
      // "Doesn't stock this fuel" never directly delists a scarce grade (final-api.md
      // §7.10.4): it opens a grade-removal correction for moderation and does NOT emit a
      // verification event, so `last_verified` is left untouched.
      return { reportKind: "fuel_removed", availability: null, outcome: null, status: "pending" };
  }
}

/**
 * Record a geofenced community check-in and (for in_stock / out_of_stock) advance the
 * station-fuel's freshness. Returns the new report id and the check-in timestamp, which is
 * the value `last_verified` moves to for an availability observation.
 *
 * The geofence itself is enforced by the route handler (contract §7); this query trusts the
 * caller-supplied, already-verified `email` for the account identity.
 */
export async function recordCheckin(
  input: CheckinInput,
  email: string,
): Promise<{ id: string; newLastVerified: string }> {
  const sql = getDb();
  if (!sql) {
    throw new DbUnavailableError("DATABASE_URL is not configured; check-ins require a database.");
  }

  const verifiedAt = new Date().toISOString();
  const p = project(input.result);
  const fuelCode = FUEL_CODE[input.grade];

  const id = await sql.begin(async (tx) => {
    // One account per verified email (final-database.md §6.8). Upsert keeps the write
    // idempotent on identity and refreshes last-seen.
    const users = await tx<{ id: string }[]>`
      INSERT INTO users (email)
      VALUES (${email.toLowerCase()})
      ON CONFLICT (email) DO UPDATE SET last_seen_at = now()
      RETURNING id
    `;
    const userId = users[0]?.id;
    if (!userId) throw new Error("failed to resolve user for check-in");

    // Every UGC write produces exactly one moderation item (final-api.md §7.12). Raw device
    // coordinates are NOT persisted — only the observation is (DPDP minimization, memo D.5);
    // the geofence pass/fail lives with the route.
    const reports = await tx<{ id: string }[]>`
      INSERT INTO app.user_reports
        (user_id, station_id, fuel_type_id, kind, availability, payload, status)
      VALUES (
        ${userId},
        ${input.stationId},
        (SELECT id FROM app.fuel_types WHERE code = ${fuelCode}),
        ${p.reportKind}::app.report_kind,
        ${p.availability}::app.availability_status,
        ${sql.json({ grade: input.grade, result: input.result })},
        ${p.status}::app.moderation_status
      )
      RETURNING id::text AS id
    `;
    const reportId = reports[0]?.id;
    if (!reportId) throw new Error("check-in insert returned no id");

    if (p.outcome) {
      // The append-only event; the projection trigger moves last_verified_at + the score.
      await tx`
        INSERT INTO app.verification_history
          (station_id, fuel_type_id, method, outcome, verified_at, verified_by, user_report_id)
        VALUES (
          ${input.stationId},
          (SELECT id FROM app.fuel_types WHERE code = ${fuelCode}),
          'user_checkin'::verification_method,
          ${p.outcome}::verification_outcome,
          ${verifiedAt}::timestamptz,
          ${userId},
          ${reportId}::bigint
        )
      `;
    }
    return reportId;
  });

  return { id, newLastVerified: verifiedAt };
}
