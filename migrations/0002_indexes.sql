-- OctaneFinder — 0002_indexes.sql
-- All secondary indexes (spec final-database.md §6.5–§6.13). Kept separate from 0001 per the
-- contract file layout. Created non-CONCURRENTLY: migrate.ts runs from an empty database, so a
-- plain CREATE INDEX inside the migration transaction is correct and cheapest here (the spec's
-- CONCURRENTLY posture is for online index builds on an already-populated production instance).
-- These run BEFORE 0003/seed so the ON CONFLICT upserts (cities.slug, fuel_prices unique) resolve.

-- Reference ---------------------------------------------------------------
CREATE UNIQUE INDEX cities_state_name_key ON app.cities (state_id, lower(name));
CREATE UNIQUE INDEX cities_slug_key        ON app.cities (slug);
CREATE INDEX fuel_types_firstclass_idx     ON app.fuel_types (id) WHERE is_premium AND NOT is_legacy;

-- Provenance --------------------------------------------------------------
CREATE INDEX data_provenance_entity_idx ON app.data_provenance (entity, entity_pk);
CREATE INDEX data_provenance_source_idx ON app.data_provenance (source_id);

-- Stations ----------------------------------------------------------------
-- Dedup: an OMC outlet code is unique within its brand.
CREATE UNIQUE INDEX stations_brand_ro_code_key
  ON app.stations (brand_id, brand_ro_code) WHERE brand_ro_code IS NOT NULL;

-- The one index the whole product stands on: index-assisted KNN + viewport (ST_DWithin / <-> / &&).
CREATE INDEX stations_location_gix ON app.stations USING gist (location);

-- Ops/moderation dedup + SSG build queries (NOT runtime typeahead — that is client-side).
CREATE INDEX stations_name_trgm ON app.stations USING gin (name gin_trgm_ops);
CREATE INDEX stations_addr_trgm ON app.stations USING gin (address gin_trgm_ops);
CREATE INDEX stations_state_idx ON app.stations (state_id);
CREATE INDEX stations_city_idx  ON app.stations (city_id);

-- Station fuels -----------------------------------------------------------
-- Map/search hot path: "outlets selling this grade, not known to be dry".
CREATE INDEX station_fuels_live_idx
  ON app.station_fuels (fuel_type_id, station_id)
  WHERE availability IN ('unknown', 'available', 'low_stock');

-- Staleness-queue scan.
CREATE INDEX station_fuels_staleness_idx
  ON app.station_fuels (last_verified_at ASC NULLS FIRST)
  WHERE availability <> 'discontinued';

-- Crowd + moderation spine ------------------------------------------------
CREATE INDEX user_reports_queue_idx   ON app.user_reports (created_at) WHERE status = 'pending';
CREATE INDEX user_reports_station_idx ON app.user_reports (station_id, created_at DESC);
CREATE INDEX user_reports_user_idx    ON app.user_reports (user_id, created_at DESC);

CREATE INDEX verification_history_sf_idx
  ON app.verification_history (station_id, fuel_type_id, verified_at DESC);

-- Images ------------------------------------------------------------------
CREATE INDEX images_station_idx ON app.images (station_id) WHERE status IN ('approved','auto_approved');
CREATE INDEX images_sha_idx     ON app.images (content_sha256);

-- Prices ------------------------------------------------------------------
CREATE INDEX fuel_prices_lookup_idx ON app.fuel_prices (city_id, fuel_type_id, effective_on DESC);

-- OSM sidecar -------------------------------------------------------------
CREATE INDEX osm_fuel_stations_gix ON osm.fuel_stations USING gist (geom);
