// Provenance ledger read/write (BUILD-CONTRACT §6, spec §6.6). The `app.data_provenance` table is
// the append-only evidence log: one row per record per acquisition, carrying the licence, retrieval
// date and evidence pointer. Reads are dual-source (DB, else the seed station's `sources[]`); writes
// require a DB and throw DbUnavailableError otherwise (same convention as the other write query
// modules, §6). The ledger itself has no seed representation — only station-level ProvenanceRefs do.

import { DbUnavailableError } from "@/lib/api";
import { getDb } from "@/lib/db";
import { stationById } from "@/lib/data";
import type { ProvenanceRef } from "@/lib/types";

export type ProvenanceEntityKind =
  | "station"
  | "station_fuel"
  | "fuel_type"
  | "fuel_price"
  | "city"
  | "image";

export interface ProvenanceLedgerEntry {
  id: string;
  entity: ProvenanceEntityKind;
  entityPk: string;
  source: string;
  license: string;
  method: string;
  retrievedAt: string;
  rawRef: string | null;
  notes: string | null;
}

export interface ProvenanceWriteInput {
  sourceSlug: string; // must reference an existing app.sources.slug
  entity: ProvenanceEntityKind;
  entityPk: string;
  method: string;
  retrievedAt?: string; // ISO; defaults to now() when omitted
  fields?: string[];
  rawRef?: string;
  notes?: string;
}

/**
 * Provenance refs for a station, in the §5 ProvenanceRef shape. DB path resolves the public id to
 * the internal uuid and reads the ledger; fallback returns the seed station's declared sources.
 */
export async function stationProvenance(publicId: string): Promise<ProvenanceRef[]> {
  const db = getDb();
  if (!db) return stationById(publicId)?.sources ?? [];

  const rows = await db<
    { source: string; license: string; retrievedAt: string; method: string }[]
  >`
    SELECT
      src.name AS source,
      COALESCE(src.license_name, src.legal_basis::text) AS license,
      to_char(dp.retrieved_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "retrievedAt",
      dp.method AS method
    FROM app.stations s
    JOIN app.data_provenance dp
      ON dp.entity = 'station'::app.provenance_entity AND dp.entity_pk = s.id::text
    JOIN app.sources src ON src.id = dp.source_id
    WHERE s.public_id = ${publicId}
    ORDER BY dp.retrieved_at DESC`;

  return rows.map((r) => ({
    source: r.source,
    license: r.license,
    retrievedAt: r.retrievedAt,
    method: r.method,
  }));
}

/**
 * Full ledger for one entity, newest acquisition first. Returns an empty list when no DB is
 * configured (the acquisition log exists only in the register).
 */
export async function listProvenance(
  entity: ProvenanceEntityKind,
  entityPk: string,
): Promise<ProvenanceLedgerEntry[]> {
  const db = getDb();
  if (!db) return [];

  const rows = await db<
    {
      id: string;
      entity: ProvenanceEntityKind;
      entityPk: string;
      source: string;
      license: string;
      method: string;
      retrievedAt: string;
      rawRef: string | null;
      notes: string | null;
    }[]
  >`
    SELECT
      dp.id::text     AS id,
      dp.entity::text AS entity,
      dp.entity_pk    AS "entityPk",
      src.name        AS source,
      COALESCE(src.license_name, src.legal_basis::text) AS license,
      dp.method       AS method,
      to_char(dp.retrieved_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "retrievedAt",
      dp.raw_ref      AS "rawRef",
      dp.notes        AS notes
    FROM app.data_provenance dp
    JOIN app.sources src ON src.id = dp.source_id
    WHERE dp.entity = ${entity}::app.provenance_entity AND dp.entity_pk = ${entityPk}
    ORDER BY dp.retrieved_at DESC`;

  return rows.map((r) => ({
    id: r.id,
    entity: r.entity,
    entityPk: r.entityPk,
    source: r.source,
    license: r.license,
    method: r.method,
    retrievedAt: r.retrievedAt,
    rawRef: r.rawRef,
    notes: r.notes,
  }));
}

/**
 * Append an acquisition row to the ledger against an existing source (by slug). Requires a DB.
 * Returns the new ledger row id.
 */
export async function recordProvenance(input: ProvenanceWriteInput): Promise<{ id: string }> {
  const db = getDb();
  if (!db) throw new DbUnavailableError("database unavailable: cannot write provenance");

  const rows = await db<{ id: string }[]>`
    INSERT INTO app.data_provenance (source_id, entity, entity_pk, method, retrieved_at, fields, raw_ref, notes)
    SELECT src.id, ${input.entity}::app.provenance_entity, ${input.entityPk}, ${input.method},
           COALESCE(${input.retrievedAt ?? null}::timestamptz, now()),
           ${input.fields ?? null}, ${input.rawRef ?? null}, ${input.notes ?? null}
    FROM app.sources src
    WHERE src.slug = ${input.sourceSlug}
    RETURNING id::text AS id`;

  const row = rows[0];
  if (!row) throw new Error(`unknown provenance source slug: ${input.sourceSlug}`);
  return { id: row.id };
}
