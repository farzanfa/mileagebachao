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
    INSERT INTO user_reports (user_id, station_id, kind, payload, status)
    VALUES (
      NULL,
      ${input.stationId},
      'detail_correction'::report_kind,
      ${sql.json({
        field: input.field,
        value: input.value,
        note: input.note ?? null,
        contact: input.contact ?? null,
      })},
      'pending'::moderation_status
    )
    RETURNING id::text AS id
  `;

  const id = rows[0]?.id;
  if (!id) throw new Error("correction insert returned no id");
  return { id };
}
