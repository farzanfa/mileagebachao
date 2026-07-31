// Correction write query (AUTHMOD slice; BUILD-CONTRACT §6, §11).
//
// A correction is a structured proposal to change a canonical field (name, location, grades
// sold, contact, hours). It enters the moderation queue as `pending` and is applied by a
// moderator via the admin queue (Waze field-lock precedent, final-api.md §7.10.5). A
// correction NEVER moves `last_verified` — only a check-in does (contract §5).
//
// Requires a database: throws DbUnavailableError when DATABASE_URL is unset so the write
// route can surface the standard 503 `db_unavailable` envelope (contract §2).

import { DbUnavailableError } from "@/lib/api";
import { getDb } from "@/lib/db";
import type { CorrectionInput } from "@/lib/types";

/**
 * Enqueue a correction for moderation. Anonymous submissions are allowed (contract §7:
 * `POST /corrections` is anonymous + rate-limited), so no user identity is required; the
 * field/value/note/contact detail is carried in the report payload.
 */
export async function submitCorrection(input: CorrectionInput): Promise<{ id: string }> {
  const sql = getDb();
  if (!sql) {
    throw new DbUnavailableError(
      "DATABASE_URL is not configured; corrections require a database.",
    );
  }

  const rows = await sql<{ id: string }[]>`
    INSERT INTO app.user_reports (user_id, station_id, kind, payload, status)
    VALUES (
      NULL,
      ${input.stationId},
      'detail_correction'::app.report_kind,
      ${sql.json({
        field: input.field,
        value: input.value,
        note: input.note ?? null,
        contact: input.contact ?? null,
      })},
      'pending'::app.moderation_status
    )
    RETURNING id::text AS id
  `;

  const id = rows[0]?.id;
  if (!id) throw new Error("correction insert returned no id");
  return { id };
}

/** Payload of a community "add a pump" report (identified reporter, moderated).
 *  Location (GPS or a Google Maps link) and reporter details are REQUIRED —
 *  unverifiable reports are how fake pins happen. */
export interface NewStationInput {
  fuel: string;
  pumpName: string;
  address: string;
  city: string;
  state: string;
  pincode?: string;
  lat?: number;
  lng?: number;
  accuracyM?: number;
  mapsLink?: string;
  note?: string;
  reporterName: string;
  reporterPhone: string;
  reporterEmail: string;
}

/**
 * Enqueue a community-suggested new pump for moderation. The user_reports schema
 * allows station_id NULL exactly when kind = 'new_station' (migration 0001 CHECK).
 */
export async function submitNewStation(input: NewStationInput): Promise<{ id: string }> {
  const sql = getDb();
  if (!sql) {
    throw new DbUnavailableError(
      "DATABASE_URL is not configured; pump suggestions require a database.",
    );
  }

  const rows = await sql<{ id: string }[]>`
    INSERT INTO app.user_reports (user_id, station_id, kind, payload, status)
    VALUES (
      NULL,
      NULL,
      'new_station'::app.report_kind,
      ${sql.json({
        fuel: input.fuel,
        pumpName: input.pumpName,
        address: input.address,
        city: input.city,
        state: input.state,
        pincode: input.pincode ?? null,
        lat: input.lat ?? null,
        lng: input.lng ?? null,
        accuracyM: input.accuracyM ?? null,
        mapsLink: input.mapsLink ?? null,
        note: input.note ?? null,
        reporter: {
          name: input.reporterName,
          phone: input.reporterPhone,
          email: input.reporterEmail,
        },
      })},
      'pending'::app.moderation_status
    )
    RETURNING id::text AS id
  `;

  const id = rows[0]?.id;
  if (!id) throw new Error("new-station insert returned no id");
  return { id };
}
