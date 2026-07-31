// Station read queries (BUILD-CONTRACT §6). DUAL-SOURCE: when DATABASE_URL is set we read the
// PostgreSQL + PostGIS register (app.* schema, spec §6.7/§6.14); otherwise we fall back to the
// committed seed dataset via data.ts, so `next build`, SSG and the read-only app run with zero
// infrastructure. Both paths return rows mapped to the §5 Station shape.

import { getDb } from "@/lib/db";
import { allStations, gradeMeta, stationById } from "@/lib/data";
import type {
  Brand,
  GradeMeta,
  GradeName,
  Price,
  ProvenanceRef,
  Station,
  StationGrade,
} from "@/lib/types";

export interface StationFilter {
  grades?: GradeName[];
  brands?: Brand[];
  e0Only?: boolean;
  query?: string;
}

type Db = NonNullable<ReturnType<typeof getDb>>;

// Shape of a fully-assembled station row from the DB (grades/price/sources arrive as parsed jsonb;
// firstSeen/lastVerified as pre-formatted ISO text so no Date round-tripping is needed).
interface RawStationRow {
  id: string;
  slug: string;
  name: string;
  brand: Brand;
  city: string | null;
  citySlug: string | null;
  state: string;
  pincode: string | null;
  lat: number | null;
  lng: number | null;
  roCode: string | null;
  address: string | null;
  phone: string | null;
  grades: StationGrade[] | null;
  price: Price | null;
  sources: ProvenanceRef[] | null;
  firstSeen: string | null;
  lastVerified: string | null;
}

/**
 * The canonical SELECT that assembles a §5-shaped station from the normalized register.
 * Returned as a composable fragment (FROM + joins, no WHERE/ORDER/LIMIT) so listStations and
 * getStation reuse identical column semantics.
 */
function stationSelect(db: Db) {
  return db`
    SELECT
      s.public_id                     AS id,
      s.slug                          AS slug,
      s.name                          AS name,
      b.code                          AS brand,
      c.name                          AS city,
      c.slug                          AS "citySlug",
      st.name                         AS state,
      s.pincode                       AS pincode,
      ST_Y(s.location::geometry)      AS lat,
      ST_X(s.location::geometry)      AS lng,
      s.brand_ro_code                 AS "roCode",
      s.address                       AS address,
      s.phone                         AS phone,
      COALESCE(g.grades, '[]'::jsonb) AS grades,
      p.price                         AS price,
      COALESCE(pr.sources, '[]'::jsonb) AS sources,
      to_char(fs.first_seen AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "firstSeen",
      CASE WHEN lv.last_verified IS NULL THEN NULL
           ELSE to_char(lv.last_verified AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
      END                             AS "lastVerified"
    FROM app.stations s
    JOIN app.brands b  ON b.id  = s.brand_id
    JOIN app.states st ON st.id = s.state_id
    LEFT JOIN app.cities c ON c.id = s.city_id
    LEFT JOIN LATERAL (
      SELECT jsonb_agg(jsonb_build_object(
        'grade', ft.grade_name,
        'availability', CASE sf.availability
          WHEN 'available'    THEN 'in_stock'
          WHEN 'low_stock'    THEN 'in_stock'
          WHEN 'out_of_stock' THEN 'out_of_stock'
          ELSE 'unknown' END,
        'lastVerifiedDays', CASE WHEN sf.last_verified_at IS NULL THEN NULL
          ELSE floor(EXTRACT(epoch FROM (now() - sf.last_verified_at)) / 86400.0)::int END,
        'checkins', sf.checkins,
        'status', CASE
          WHEN sf.last_verified_at IS NULL THEN 'official-listed'
          WHEN now() - sf.last_verified_at <= interval '30 days' THEN 'field-verified'
          ELSE 'stale' END
      ) ORDER BY ft.ron DESC) AS grades
      FROM app.station_fuels sf
      JOIN app.fuel_types ft ON ft.id = sf.fuel_type_id
      WHERE sf.station_id = s.id AND sf.availability <> 'discontinued'::app.availability_status
    ) g ON true
    LEFT JOIN LATERAL (
      SELECT jsonb_build_object(
        'grade', ft.grade_name,
        'value', to_char(sf.last_price_paise / 100.0, 'FM9990.00'),
        'currency', 'INR',
        'source', src.name,
        'asOf', to_char(sf.last_price_at AT TIME ZONE 'UTC', 'YYYY-MM-DD')
      ) AS price
      FROM app.station_fuels sf
      JOIN app.fuel_types ft ON ft.id = sf.fuel_type_id
      LEFT JOIN app.sources src ON src.id = sf.last_price_source_id
      WHERE sf.station_id = s.id AND sf.last_price_paise IS NOT NULL
      ORDER BY sf.last_price_at DESC NULLS LAST
      LIMIT 1
    ) p ON true
    LEFT JOIN LATERAL (
      SELECT jsonb_agg(jsonb_build_object(
        'source', src.name,
        'license', COALESCE(src.license_name, src.legal_basis::text),
        'retrievedAt', to_char(dp.retrieved_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'method', dp.method
      ) ORDER BY dp.retrieved_at DESC) AS sources
      FROM app.data_provenance dp
      JOIN app.sources src ON src.id = dp.source_id
      WHERE dp.entity = 'station'::app.provenance_entity AND dp.entity_pk = s.id::text
    ) pr ON true
    LEFT JOIN LATERAL (
      SELECT min(sf.first_listed_at) AS first_seen FROM app.station_fuels sf WHERE sf.station_id = s.id
    ) fs ON true
    LEFT JOIN LATERAL (
      SELECT max(sf.last_verified_at) AS last_verified FROM app.station_fuels sf WHERE sf.station_id = s.id
    ) lv ON true
  `;
}

/** Build the composable WHERE fragment for a StationFilter. Kept as a fresh fragment per call. */
function whereFragment(db: Db, f: StationFilter) {
  const grades = f.grades && f.grades.length > 0 ? f.grades : null;
  const brands = f.brands && f.brands.length > 0 ? f.brands : null;
  const q = f.query && f.query.trim().length > 0 ? `%${f.query.trim()}%` : null;
  const e0 = f.e0Only === true;

  return db`
    WHERE s.status <> 'duplicate'::app.station_status
    ${grades
      ? db`AND EXISTS (SELECT 1 FROM app.station_fuels sfx JOIN app.fuel_types ftx ON ftx.id = sfx.fuel_type_id
             WHERE sfx.station_id = s.id AND ftx.grade_name = ANY(${grades}))`
      : db``}
    ${brands ? db`AND b.code = ANY(${brands})` : db``}
    ${e0
      ? db`AND EXISTS (SELECT 1 FROM app.station_fuels sfe JOIN app.fuel_types fte ON fte.id = sfe.fuel_type_id
             WHERE sfe.station_id = s.id AND fte.ethanol_free IS TRUE)`
      : db``}
    ${q
      ? db`AND (s.name ILIKE ${q} OR s.address ILIKE ${q} OR c.name ILIKE ${q}
               OR st.name ILIKE ${q} OR s.pincode ILIKE ${q})`
      : db``}
  `;
}

function mapRow(r: RawStationRow): Station {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    brand: r.brand,
    city: r.city ?? "",
    citySlug: r.citySlug ?? "",
    state: r.state,
    pincode: r.pincode ?? "",
    lat: r.lat ?? 0,
    lng: r.lng ?? 0,
    roCode: r.roCode ?? "",
    address: r.address ?? "",
    phone: r.phone,
    grades: r.grades ?? [],
    price: r.price,
    sources: r.sources ?? [],
    firstSeen: r.firstSeen ?? "",
    lastVerified: r.lastVerified,
  };
}

// ---- Seed fallback (no DB) -------------------------------------------------

function matchesFilter(s: Station, f: StationFilter, gm: Record<GradeName, GradeMeta>): boolean {
  const brands = f.brands;
  if (brands && brands.length > 0 && !brands.includes(s.brand)) return false;

  const grades = f.grades;
  if (grades && grades.length > 0 && !s.grades.some((g) => grades.includes(g.grade))) return false;

  if (f.e0Only === true && !s.grades.some((g) => gm[g.grade]?.e0 === true)) return false;

  const query = f.query?.trim();
  if (query) {
    const q = query.toLowerCase();
    const haystack = [s.name, s.address, s.city, s.state, s.pincode].join(" ").toLowerCase();
    if (!haystack.includes(q)) return false;
  }
  return true;
}

function listFromSeed(
  f: StationFilter,
  limit: number,
  offset: number,
): { rows: Station[]; total: number } {
  const gm = gradeMeta();
  const matched = allStations()
    .filter((s) => matchesFilter(s, f, gm))
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  return { rows: matched.slice(offset, offset + limit), total: matched.length };
}

// ---- Public API ------------------------------------------------------------

export async function listStations(
  f: StationFilter,
  limit: number,
  offset: number,
): Promise<{ rows: Station[]; total: number }> {
  const db = getDb();
  if (!db) return listFromSeed(f, limit, offset);

  const countRows = await db<{ count: number }[]>`
    SELECT count(*)::int AS count
    FROM app.stations s
    JOIN app.brands b  ON b.id  = s.brand_id
    JOIN app.states st ON st.id = s.state_id
    LEFT JOIN app.cities c ON c.id = s.city_id
    ${whereFragment(db, f)}`;
  const total = countRows[0]?.count ?? 0;

  const rows = await db<RawStationRow[]>`
    ${stationSelect(db)}
    ${whereFragment(db, f)}
    ORDER BY s.name ASC, s.public_id ASC
    LIMIT ${limit} OFFSET ${offset}`;

  return { rows: rows.map(mapRow), total };
}

export async function getStation(id: string): Promise<Station | null> {
  const db = getDb();
  if (!db) return stationById(id) ?? null;

  const rows = await db<RawStationRow[]>`
    ${stationSelect(db)}
    WHERE s.public_id = ${id}
    LIMIT 1`;
  const row = rows[0];
  return row ? mapRow(row) : null;
}
