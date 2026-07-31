/**
 * scripts/seed.ts — load data/stations.seed.json into the proprietary register (app.*) and the
 * append-only provenance ledger. (BUILD-CONTRACT §1 `npm run seed`, spec §6.15.)
 *
 * Idempotent upsert:
 *   - stations keyed on public_id (the contract Station.id);
 *   - station_fuels keyed on (station_id, fuel_type_id);
 *   - cities/sources upserted by slug; provenance rows appended only when absent (append-only log).
 * Reference data (states/brands/fuel_types/sources registry) must already exist — it is created by
 * migrations/0003_seed_reference.sql, so run `npm run migrate` before `npm run seed`.
 *
 * The seed IS the initial projection of the verification log: it writes station_fuels state
 * (availability, last_verified_at, checkins, authoritative price) directly rather than replaying
 * events, so it is not for use against a DB that already carries live check-ins.
 *
 * Requires DATABASE_URL. Ops script — never runs during `next build`.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import postgres from "postgres";

import type { Station } from "../src/lib/types";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SEED_PATH = path.resolve(HERE, "..", "data", "stations.seed.json");

// contract Availability -> app.availability_status
const AVAIL_TO_DB: Record<string, string> = {
  in_stock: "available",
  out_of_stock: "out_of_stock",
  unknown: "unknown",
};

// U+0300–U+036F combining diacritical marks; built via RegExp() so the source stays pure ASCII.
const COMBINING_MARKS = new RegExp("[\\u0300-\\u036f]", "g");

function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// provenance method string -> app.legal_basis
function legalBasisFor(method: string): string {
  switch (method) {
    case "official-list":
    case "product-page-table":
      return "omc_public_page";
    case "locator-api":
      return "unofficial_api";
    case "user-report":
      return "user_submission";
    default:
      return "first_party";
  }
}

function need<T>(value: T | undefined, message: string): T {
  if (value === undefined) throw new Error(message);
  return value;
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("[seed] DATABASE_URL is not set — nothing to seed.");
    process.exit(1);
  }

  const stations = JSON.parse(await readFile(SEED_PATH, "utf8")) as Station[];
  const now = Date.now();

  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await sql.begin(async (tx) => {
      // --- reference lookups (created by 0003) ---
      const brandRows = await tx<{ id: number; code: string }[]>`SELECT id, code FROM app.brands`;
      const stateRows = await tx<{ id: number; name: string }[]>`SELECT id, name FROM app.states`;
      const fuelRows =
        await tx<{ id: number; grade_name: string; code: string }[]>`SELECT id, grade_name, code FROM app.fuel_types`;

      const brandId = new Map(brandRows.map((r) => [r.code, r.id] as const));
      const stateId = new Map(stateRows.map((r) => [r.name, r.id] as const));
      const fuelId = new Map(fuelRows.map((r) => [r.grade_name, r.id] as const));
      const fuelCode = new Map(fuelRows.map((r) => [r.grade_name, r.code] as const));

      if (brandRows.length === 0 || stateRows.length === 0 || fuelRows.length === 0) {
        throw new Error("[seed] reference data missing — run `npm run migrate` first.");
      }

      const cityIdCache = new Map<string, number>();
      const sourceIdCache = new Map<string, number>();

      async function upsertCity(name: string, slug: string, stId: number): Promise<number> {
        const cached = cityIdCache.get(slug);
        if (cached !== undefined) return cached;
        const rows = await tx<{ id: number }[]>`
          INSERT INTO app.cities (state_id, name, slug)
          VALUES (${stId}, ${name}, ${slug})
          ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, state_id = EXCLUDED.state_id
          RETURNING id`;
        const id = need(rows[0], `city upsert returned no row for ${slug}`).id;
        cityIdCache.set(slug, id);
        return id;
      }

      async function upsertSource(name: string, method: string, license: string): Promise<number> {
        const slug = slugify(name);
        const cached = sourceIdCache.get(slug);
        if (cached !== undefined) return cached;
        const rows = await tx<{ id: number }[]>`
          INSERT INTO app.sources (slug, name, legal_basis, license_name)
          VALUES (${slug}, ${name}, ${legalBasisFor(method)}::app.legal_basis, ${license})
          ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
          RETURNING id`;
        const id = need(rows[0], `source upsert returned no row for ${slug}`).id;
        sourceIdCache.set(slug, id);
        return id;
      }

      let stationCount = 0;
      let fuelCount = 0;

      for (const s of stations) {
        const bId = need(brandId.get(s.brand), `unknown brand ${s.brand} for ${s.id}`);
        const stId = need(stateId.get(s.state), `unknown state ${s.state} for ${s.id}`);
        const cityId = await upsertCity(s.city, s.citySlug, stId);

        const primary = s.sources[0];
        if (!primary) throw new Error(`station ${s.id} has no provenance source`);
        const primarySourceId = await upsertSource(primary.source, primary.method, primary.license);

        const stationRows = await tx<{ id: string }[]>`
          INSERT INTO app.stations
            (public_id, slug, brand_id, name, brand_ro_code, address, pincode, city_id, state_id,
             location, location_accuracy_m, status, phone, primary_source_id, created_at)
          VALUES
            (${s.id}, ${s.slug}, ${bId}, ${s.name}, ${s.roCode}, ${s.address}, ${s.pincode},
             ${cityId}, ${stId},
             ST_SetSRID(ST_MakePoint(${s.lng}, ${s.lat}), 4326)::geography, 100,
             'active'::app.station_status, ${s.phone}, ${primarySourceId}, ${s.firstSeen})
          ON CONFLICT (public_id) DO UPDATE SET
            slug = EXCLUDED.slug, brand_id = EXCLUDED.brand_id, name = EXCLUDED.name,
            brand_ro_code = EXCLUDED.brand_ro_code, address = EXCLUDED.address, pincode = EXCLUDED.pincode,
            city_id = EXCLUDED.city_id, state_id = EXCLUDED.state_id, location = EXCLUDED.location,
            location_accuracy_m = EXCLUDED.location_accuracy_m, status = EXCLUDED.status,
            phone = EXCLUDED.phone, primary_source_id = EXCLUDED.primary_source_id, updated_at = now()
          RETURNING id`;
        const stationUuid = need(stationRows[0], `station upsert returned no row for ${s.id}`).id;
        stationCount += 1;

        // Provenance ledger: append one row per source per entity when not already present.
        for (const src of s.sources) {
          const srcId = await upsertSource(src.source, src.method, src.license);
          await tx`
            INSERT INTO app.data_provenance (source_id, entity, entity_pk, method, retrieved_at)
            SELECT ${srcId}, 'station'::app.provenance_entity, ${stationUuid}::text, ${src.method}, ${src.retrievedAt}
            WHERE NOT EXISTS (
              SELECT 1 FROM app.data_provenance
              WHERE source_id = ${srcId} AND entity = 'station'::app.provenance_entity
                AND entity_pk = ${stationUuid}::text AND method = ${src.method}
            )`;
        }

        for (const g of s.grades) {
          const fId = need(fuelId.get(g.grade), `unknown grade ${g.grade} for ${s.id}`);
          const code = need(fuelCode.get(g.grade), `unknown grade code for ${g.grade}`);
          const dbAvail = need(AVAIL_TO_DB[g.availability], `unmapped availability ${g.availability}`);
          const lastVerifiedAt =
            g.lastVerifiedDays === null
              ? null
              : new Date(now - g.lastVerifiedDays * 86_400_000).toISOString();
          const lastMethod = g.lastVerifiedDays === null ? null : "field_visit";

          const price = s.price && s.price.grade === g.grade ? s.price : null;
          const pricePaise = price ? Math.round(parseFloat(price.value) * 100) : null;
          const priceAt = price ? price.asOf : null;
          const priceSourceId = price
            ? await upsertSource(price.source, "locator-api", "facts:EBC-v-Modak")
            : null;

          await tx`
            INSERT INTO app.station_fuels
              (station_id, fuel_type_id, availability, first_listed_at, last_verified_at,
               last_verified_method, checkins, last_price_paise, last_price_at, last_price_source_id)
            VALUES
              (${stationUuid}, ${fId}, ${dbAvail}::app.availability_status, ${s.firstSeen},
               ${lastVerifiedAt}, ${lastMethod}::app.verification_method, ${g.checkins},
               ${pricePaise}, ${priceAt}, ${priceSourceId})
            ON CONFLICT (station_id, fuel_type_id) DO UPDATE SET
              availability = EXCLUDED.availability, last_verified_at = EXCLUDED.last_verified_at,
              last_verified_method = EXCLUDED.last_verified_method, checkins = EXCLUDED.checkins,
              last_price_paise = EXCLUDED.last_price_paise, last_price_at = EXCLUDED.last_price_at,
              last_price_source_id = EXCLUDED.last_price_source_id, updated_at = now()`;
          fuelCount += 1;

          // Provenance floor for the fuel row (nightly integrity check §6.14).
          await tx`
            INSERT INTO app.data_provenance (source_id, entity, entity_pk, method, retrieved_at, fields)
            SELECT ${primarySourceId}, 'station_fuel'::app.provenance_entity,
                   ${`${stationUuid}/${code}`}, ${primary.method}, ${primary.retrievedAt},
                   ARRAY['availability','last_verified_at']
            WHERE NOT EXISTS (
              SELECT 1 FROM app.data_provenance
              WHERE entity = 'station_fuel'::app.provenance_entity
                AND entity_pk = ${`${stationUuid}/${code}`} AND source_id = ${primarySourceId}
            )`;

          // Authoritative city-level price series (only Speed 100 carries a price in seed data).
          if (price && pricePaise !== null && priceSourceId !== null && priceAt !== null) {
            await tx`
              INSERT INTO app.fuel_prices
                (brand_id, fuel_type_id, city_id, price_paise, effective_on, publication, source_id)
              VALUES
                (${bId}, ${fId}, ${cityId}, ${pricePaise}, ${priceAt}::date,
                 'authoritative'::app.price_publication, ${priceSourceId})
              ON CONFLICT (brand_id, fuel_type_id, city_id, effective_on) DO UPDATE SET
                price_paise = EXCLUDED.price_paise, publication = EXCLUDED.publication,
                source_id = EXCLUDED.source_id`;
          }
        }
      }

      console.log(`[seed] upserted ${stationCount} stations, ${fuelCount} station_fuels rows.`);
    });
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err: unknown) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});
