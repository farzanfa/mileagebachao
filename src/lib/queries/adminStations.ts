// Admin station management (DB-only; the dashboard requires a database).
// Edits land in app.stations / app.station_fuels; the public map serves the
// committed bundle, so changes go live via `npm run publish:data` (export -> commit).

import { DbUnavailableError } from "@/lib/api";
import { getDb } from "@/lib/db";
import { toSlug } from "@/lib/geo";
import type { GradeName } from "@/lib/types";

export interface AdminStationRow {
  publicId: string;
  name: string;
  brand: string;
  city: string | null;
  state: string;
  pincode: string | null;
  phone: string | null;
  lat: number | null;
  lng: number | null;
  status: string;
  grades: string;
  updatedAt: string;
}

export interface AdminStationDetail extends AdminStationRow {
  address: string | null;
  roCode: string | null;
  slug: string;
}

export interface AdminStationUpdate {
  name: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  lat: number | null;
  lng: number | null;
  status: string;
}

function requireDb() {
  const sql = getDb();
  if (!sql) throw new DbUnavailableError("Admin station management requires a database.");
  return sql;
}

export interface AdminStats {
  stations: number;
  byBrand: { brand: string; n: number }[];
  byStatus: { status: string; n: number }[];
  pendingReports: number;
  lastEdit: string | null;
}

export async function adminStats(): Promise<AdminStats> {
  const sql = requireDb();
  const [tot, brands, statuses, pend, last] = await Promise.all([
    sql<{ n: number }[]>`SELECT count(*)::int AS n FROM app.stations`,
    sql<{ brand: string; n: number }[]>`
      SELECT b.code AS brand, count(*)::int AS n FROM app.stations s
      JOIN app.brands b ON b.id = s.brand_id GROUP BY 1 ORDER BY 2 DESC`,
    sql<{ status: string; n: number }[]>`
      SELECT status::text AS status, count(*)::int AS n FROM app.stations GROUP BY 1 ORDER BY 2 DESC`,
    sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM app.user_reports WHERE status = 'pending'::app.moderation_status`,
    sql<{ t: string | null }[]>`
      SELECT to_char(max(updated_at), 'YYYY-MM-DD HH24:MI') AS t FROM app.stations`,
  ]);
  return {
    stations: tot[0]?.n ?? 0,
    byBrand: brands,
    byStatus: statuses,
    pendingReports: pend[0]?.n ?? 0,
    lastEdit: last[0]?.t ?? null,
  };
}

export async function listAdminStations(
  q: string,
  limit: number,
  offset: number,
): Promise<{ rows: AdminStationRow[]; total: number }> {
  const sql = requireDb();
  const like = `%${q.trim()}%`;
  const where = q.trim()
    ? sql`WHERE (s.name ILIKE ${like} OR s.address ILIKE ${like} OR c.name ILIKE ${like}
               OR st.name ILIKE ${like} OR s.pincode ILIKE ${like} OR s.public_id ILIKE ${like})`
    : sql``;
  const rows = await sql<AdminStationRow[]>`
    SELECT s.public_id AS "publicId", s.name, b.code AS brand,
           c.name AS city, st.name AS state, s.pincode, s.phone,
           ST_Y(s.location::geometry) AS lat, ST_X(s.location::geometry) AS lng,
           s.status::text AS status,
           COALESCE((SELECT string_agg(ft.grade_name, ', ' ORDER BY ft.grade_name)
                       FROM app.station_fuels sf JOIN app.fuel_types ft ON ft.id = sf.fuel_type_id
                      WHERE sf.station_id = s.id), '') AS grades,
           to_char(s.updated_at, 'YYYY-MM-DD HH24:MI') AS "updatedAt"
      FROM app.stations s
      JOIN app.brands b ON b.id = s.brand_id
      JOIN app.states st ON st.id = s.state_id
      LEFT JOIN app.cities c ON c.id = s.city_id
      ${where}
     ORDER BY s.updated_at DESC
     LIMIT ${limit} OFFSET ${offset}`;
  const totalRows = await sql<{ n: number }[]>`
    SELECT count(*)::int AS n
      FROM app.stations s
      JOIN app.brands b ON b.id = s.brand_id
      JOIN app.states st ON st.id = s.state_id
      LEFT JOIN app.cities c ON c.id = s.city_id
      ${where}`;
  return { rows, total: totalRows[0]?.n ?? 0 };
}

export async function getAdminStation(publicId: string): Promise<AdminStationDetail | null> {
  const sql = requireDb();
  const rows = await sql<AdminStationDetail[]>`
    SELECT s.public_id AS "publicId", s.name, b.code AS brand, s.slug,
           c.name AS city, st.name AS state, s.pincode, s.phone, s.address,
           s.brand_ro_code AS "roCode",
           ST_Y(s.location::geometry) AS lat, ST_X(s.location::geometry) AS lng,
           s.status::text AS status,
           COALESCE((SELECT string_agg(ft.grade_name, ', ' ORDER BY ft.grade_name)
                       FROM app.station_fuels sf JOIN app.fuel_types ft ON ft.id = sf.fuel_type_id
                      WHERE sf.station_id = s.id), '') AS grades,
           to_char(s.updated_at, 'YYYY-MM-DD HH24:MI') AS "updatedAt"
      FROM app.stations s
      JOIN app.brands b ON b.id = s.brand_id
      JOIN app.states st ON st.id = s.state_id
      LEFT JOIN app.cities c ON c.id = s.city_id
     WHERE s.public_id = ${publicId}`;
  return rows[0] ?? null;
}

export async function listStates(): Promise<string[]> {
  const sql = requireDb();
  const rows = await sql<{ name: string }[]>`SELECT name FROM app.states ORDER BY name`;
  return rows.map((r) => r.name);
}

/** Update a station's editable fields. State must exist; city is upserted within it. */
export async function updateAdminStation(publicId: string, u: AdminStationUpdate): Promise<void> {
  const sql = requireDb();
  await sql.begin(async (tx) => {
    const st = await tx<{ id: number }[]>`SELECT id FROM app.states WHERE name = ${u.state}`;
    const stateId = st[0]?.id;
    if (!stateId) throw new Error(`Unknown state: ${u.state}`);

    let cityId: number | null = null;
    if (u.city.trim()) {
      const slug = toSlug(u.city);
      const existing = await tx<{ id: number }[]>`
        SELECT id FROM app.cities WHERE state_id = ${stateId} AND slug = ${slug}`;
      if (existing[0]) cityId = existing[0].id;
      else {
        const ins = await tx<{ id: number }[]>`
          INSERT INTO app.cities (state_id, name, slug) VALUES (${stateId}, ${u.city.trim()}, ${slug})
          RETURNING id`;
        cityId = ins[0]?.id ?? null;
      }
    }

    const pincode = /^[1-9][0-9]{5}$/.test(u.pincode.trim()) ? u.pincode.trim() : null;
    const phone = u.phone.trim() || null;
    const hasLoc = u.lat !== null && u.lng !== null;

    await tx`
      UPDATE app.stations SET
        name = ${u.name.trim()},
        address = ${u.address.trim() || null},
        pincode = ${pincode},
        phone = ${phone},
        city_id = ${cityId},
        state_id = ${stateId},
        location = ${hasLoc ? tx`ST_SetSRID(ST_MakePoint(${u.lng}, ${u.lat}), 4326)::geography` : null},
        status = ${u.status}::app.station_status,
        updated_at = now()
      WHERE public_id = ${publicId}`;
  });
}

/** Promote an approved 'new_station' report into a real (unverified) station. */
export async function promoteNewStationReport(reportId: string): Promise<string> {
  const sql = requireDb();
  return await sql.begin(async (tx) => {
    const reps = await tx<{ id: string; payload: Record<string, unknown> }[]>`
      SELECT id::text AS id, payload FROM app.user_reports
       WHERE id = ${reportId}::bigint AND kind = 'new_station'::app.report_kind`;
    const rep = reps[0];
    if (!rep) throw new Error("new_station report not found");
    const p = rep.payload;
    const fuel = String(p.fuel ?? "");
    const grade = (fuel === "Not sure" ? "XP100" : fuel) as GradeName;

    const ft = await tx<{ id: number; brand_id: number }[]>`
      SELECT id, brand_id FROM app.fuel_types WHERE grade_name = ${grade}`;
    if (!ft[0]) throw new Error(`Unknown grade: ${grade}`);

    const st = await tx<{ id: number }[]>`SELECT id FROM app.states WHERE name = ${String(p.state ?? "")}`;
    if (!st[0]) throw new Error(`Unknown state: ${String(p.state)}`);
    const stateId = st[0].id;

    const cityName = String(p.city ?? "").trim();
    let cityId: number | null = null;
    if (cityName) {
      const slug = toSlug(cityName);
      const existing = await tx<{ id: number }[]>`
        SELECT id FROM app.cities WHERE state_id = ${stateId} AND slug = ${slug}`;
      cityId =
        existing[0]?.id ??
        (
          await tx<{ id: number }[]>`
            INSERT INTO app.cities (state_id, name, slug) VALUES (${stateId}, ${cityName}, ${slug})
            RETURNING id`
        )[0]!.id;
    }

    const srcRows = await tx<{ id: number }[]>`
      INSERT INTO app.sources (slug, name, legal_basis, license_name)
      VALUES ('community-report', 'Community report (Add a pump)', 'user_submission', 'facts')
      ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
      RETURNING id`;
    const sourceId = srcRows[0]!.id;

    const lat = typeof p.lat === "number" ? p.lat : null;
    const lng = typeof p.lng === "number" ? p.lng : null;
    const pincodeRaw = String(p.pincode ?? "").trim();
    const pincode = /^[1-9][0-9]{5}$/.test(pincodeRaw) ? pincodeRaw : null;
    const publicId = `community-${rep.id}`;
    const slug = `${toSlug(`${String(p.pumpName ?? "pump")}-${cityName || "india"}`)}-${rep.id}`.slice(0, 90);

    const stn = await tx<{ id: string }[]>`
      INSERT INTO app.stations
        (public_id, slug, brand_id, name, address, pincode, city_id, state_id,
         location, status, phone, primary_source_id)
      VALUES
        (${publicId}, ${slug}, ${ft[0].brand_id}, ${String(p.pumpName ?? "Community-reported pump")},
         ${String(p.address ?? "") || null}, ${pincode}, ${cityId}, ${stateId},
         ${lat !== null && lng !== null ? tx`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography` : null},
         'unverified'::app.station_status, null, ${sourceId})
      RETURNING id`;

    await tx`
      INSERT INTO app.station_fuels (station_id, fuel_type_id, availability)
      VALUES (${stn[0]!.id}, ${ft[0].id}, 'unknown'::app.availability_status)
      ON CONFLICT DO NOTHING`;

    await tx`
      INSERT INTO app.data_provenance (source_id, entity, entity_pk, retrieved_at, method, notes)
      VALUES (${sourceId}, 'station'::app.provenance_entity, ${stn[0]!.id}, now(),
              'user-report (Add a pump); pending field verification', ${`report #${rep.id}`})`;

    return publicId;
  });
}
