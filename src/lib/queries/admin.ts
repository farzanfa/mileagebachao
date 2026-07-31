// Moderation-queue read/decide queries (AUTHMOD slice; BUILD-CONTRACT §6, §11).
//
// The queue is the operational heart of the "most reliable database" (final-api.md §7.10.8):
// every UGC write (check-in, correction, add-a-station) surfaces here as one row. Both queries
// require a database and throw DbUnavailableError when DATABASE_URL is unset (contract §2).

import { DbUnavailableError } from "@/lib/api";
import { getDb } from "@/lib/db";

export interface QueueItem {
  id: string;
  type: "correction" | "checkin" | "new_station";
  stationId: string | null;
  payload: unknown;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

// Map the public queue vocabulary onto the DB `report_kind` enum (final-database.md §6.4).
const KINDS_FOR_TYPE: Record<QueueItem["type"], string[]> = {
  checkin: ["availability_checkin"],
  new_station: ["new_station"],
  correction: ["detail_correction", "fuel_removed", "station_closed", "price_report", "photo_upload"],
};

// Collapse the DB `moderation_status` enum onto the three public states.
const STATUSES_FOR_STATUS: Record<QueueItem["status"], string[]> = {
  pending: ["pending"],
  approved: ["approved", "auto_approved"],
  rejected: ["rejected", "spam"],
};

interface QueueRow {
  id: string;
  type: QueueItem["type"];
  station_id: string | null;
  payload: unknown;
  status: QueueItem["status"];
  created_at: Date | string;
}

function toIso(v: Date | string): string {
  return v instanceof Date ? v.toISOString() : new Date(v).toISOString();
}

function isType(t: string): t is QueueItem["type"] {
  return t === "checkin" || t === "new_station" || t === "correction";
}
function isStatus(s: string): s is QueueItem["status"] {
  return s === "pending" || s === "approved" || s === "rejected";
}

/**
 * List moderation items, newest first (pending items first). `type` / `status` filters use the
 * public vocabulary ("correction" | "checkin" | "new_station"; "pending" | "approved" |
 * "rejected"); unknown values match nothing rather than erroring.
 */
export async function listQueue(opts: { type?: string; status?: string }): Promise<QueueItem[]> {
  const sql = getDb();
  if (!sql) {
    throw new DbUnavailableError(
      "DATABASE_URL is not configured; the moderation queue requires a database.",
    );
  }

  // null => no filter (match all); an empty array => match nothing (unknown filter value).
  const kinds =
    opts.type === undefined ? null : isType(opts.type) ? KINDS_FOR_TYPE[opts.type] : [];
  const statuses =
    opts.status === undefined
      ? null
      : isStatus(opts.status)
        ? STATUSES_FOR_STATUS[opts.status]
        : [];

  const rows = await sql<QueueRow[]>`
    SELECT
      id::text AS id,
      CASE
        WHEN kind = 'availability_checkin' THEN 'checkin'
        WHEN kind = 'new_station'          THEN 'new_station'
        ELSE 'correction'
      END AS type,
      station_id::text AS station_id,
      payload,
      CASE
        WHEN status = 'pending'                      THEN 'pending'
        WHEN status IN ('approved', 'auto_approved') THEN 'approved'
        ELSE 'rejected'
      END AS status,
      created_at
    FROM user_reports
    WHERE (${kinds}::text[] IS NULL OR kind::text = ANY (${kinds}::text[]))
      AND (${statuses}::text[] IS NULL OR status::text = ANY (${statuses}::text[]))
    ORDER BY (status = 'pending') DESC, created_at DESC
    LIMIT 500
  `;

  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    stationId: r.station_id,
    payload: r.payload,
    status: r.status,
    createdAt: toIso(r.created_at),
  }));
}

/**
 * Approve or reject a queue item. The moderator note (when present) is appended to the report
 * payload. Returns the item id and its resulting collapsed status. Throws when the item does
 * not exist so the route can distinguish it from the db-unavailable path.
 */
export async function decideQueue(
  id: string,
  decision: "approve" | "reject",
  note?: string,
): Promise<{ id: string; status: string }> {
  const sql = getDb();
  if (!sql) {
    throw new DbUnavailableError(
      "DATABASE_URL is not configured; moderation decisions require a database.",
    );
  }

  const nextStatus = decision === "approve" ? "approved" : "rejected";
  const noteVal = note && note.trim().length > 0 ? note.trim() : null;

  const rows = await sql<{ id: string; status: string }[]>`
    UPDATE user_reports
       SET status = ${nextStatus}::moderation_status,
           reviewed_at = now(),
           payload = CASE
             WHEN ${noteVal}::text IS NULL THEN payload
             ELSE COALESCE(payload, '{}'::jsonb)
                  || jsonb_build_object('moderator_note', ${noteVal}::text)
           END
     WHERE id = ${id}::bigint
     RETURNING id::text AS id, status::text AS status
  `;

  const row = rows[0];
  if (!row) throw new Error(`moderation item ${id} not found`);
  return { id: row.id, status: row.status };
}
