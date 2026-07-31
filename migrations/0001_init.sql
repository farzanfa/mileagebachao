-- OctaneFinder — 0001_init.sql
-- PostgreSQL 16 + PostGIS schema (BUILD-CONTRACT §11 DB; spec final-database.md §6).
--
-- Design notes / reconciliations with the contract §5 Station shape (documented in-line):
--   * Three logically separated stores as SCHEMAS: app (proprietary register), osm (ODbL),
--     gov (GODL). Never row-merged. Runtime queries fully-qualify `app.`/`osm.`/`gov.` so nothing
--     depends on search_path (the db.ts pool connects with the default search_path).
--   * `stations.public_id` + `stations.slug` carry the contract's stable Station.id / Station.slug
--     ("iocl-dl-0421" / "connaught-place-indianoil"); the uuid PK stays internal (FK spine, anti-enum).
--   * `fuel_types.grade_name` carries the exact contract GradeName ("poWer 100"), so the read layer
--     maps grade rows to the §5 union without a hardcoded CASE.
--   * `station_fuels.checkins` denormalizes the crowd-confirmation count that StationGrade.checkins
--     exposes; production derives it from verification_history, the seed sets it directly.
--   * `station_fuels.last_price_source_id` lets the read layer reconstruct Price.source/asOf for the
--     authoritative-only per-station price snapshot.
-- Current state is a projection of the append-only verification_history log (never hand-edited);
-- the projection trigger + score function live in this file.

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;   -- ops/moderation dedup + SSG build queries
CREATE EXTENSION IF NOT EXISTS citext  WITH SCHEMA public;   -- case-insensitive emails

CREATE SCHEMA IF NOT EXISTS app;   -- proprietary premium-outlet register (the product)
CREATE SCHEMA IF NOT EXISTS osm;   -- ODbL 1.0 OSM geometry sidecar (never merged into app)
CREATE SCHEMA IF NOT EXISTS gov;   -- GODL-India government statistics (denominators only)

-- ---------------------------------------------------------------------------
-- Enums (additive-only policy: ALTER TYPE ... ADD VALUE, never remove/rename)
-- ---------------------------------------------------------------------------
CREATE TYPE app.station_status AS ENUM (
  'unverified', 'active', 'temporarily_closed', 'permanently_closed', 'duplicate'
);

CREATE TYPE app.availability_status AS ENUM (
  'unknown', 'available', 'low_stock', 'out_of_stock', 'discontinued'
);

CREATE TYPE app.verification_method AS ENUM (
  'omc_official_list', 'rti_response', 'partner_api_probe', 'field_visit',
  'phone_call', 'user_checkin', 'moderator_desk'
);

CREATE TYPE app.verification_outcome AS ENUM (
  'confirmed_available', 'confirmed_low_stock', 'confirmed_out_of_stock',
  'fuel_not_sold', 'station_closed', 'inconclusive'
);

CREATE TYPE app.report_kind AS ENUM (
  'availability_checkin', 'price_report', 'new_station', 'fuel_removed',
  'station_closed', 'detail_correction', 'photo_upload'
);

CREATE TYPE app.moderation_status AS ENUM (
  'pending', 'auto_approved', 'approved', 'rejected', 'spam'
);

CREATE TYPE app.legal_basis AS ENUM (
  'first_party', 'user_submission', 'godl_india', 'rti_response', 'omc_public_page',
  'written_permission', 'unofficial_api', 'odbl_osm', 'press_secondary'
);

CREATE TYPE app.image_kind AS ENUM (
  'station_exterior', 'pump_dispenser', 'price_board', 'fuel_receipt', 'other'
);

CREATE TYPE app.provenance_entity AS ENUM (
  'station', 'station_fuel', 'fuel_type', 'fuel_price', 'city', 'image'
);

CREATE TYPE app.price_publication AS ENUM (
  'authoritative', 'multi_source_confirmed', 'single_source_unverified'
);

-- ---------------------------------------------------------------------------
-- Reference tables
-- ---------------------------------------------------------------------------
CREATE TABLE app.states (
  id                  smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  iso_code            text NOT NULL UNIQUE CHECK (iso_code ~ '^IN-[A-Z]{2}$'),  -- ISO 3166-2:IN
  name                text NOT NULL UNIQUE,
  is_union_territory  boolean NOT NULL DEFAULT false
);

CREATE TABLE app.cities (
  id         integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  state_id   smallint NOT NULL REFERENCES app.states(id),
  name       text NOT NULL,
  slug       text NOT NULL,   -- SSG canonical URL segment (Station.citySlug), e.g. "delhi"
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app.brands (
  id      smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code    text NOT NULL UNIQUE,   -- 'IOCL','BPCL','HPCL','NAYARA','JIOBP','SHELL'
  name    text NOT NULL,
  is_psu  boolean NOT NULL DEFAULT true
);

CREATE TABLE app.fuel_types (
  id               smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code             text NOT NULL UNIQUE,        -- 'XP100','POWER100','SPEED100','POWER99','SPEED97'
  grade_name       text NOT NULL UNIQUE,        -- exact contract GradeName, e.g. 'poWer 100' (reconciliation)
  brand_id         smallint NOT NULL REFERENCES app.brands(id),
  display_name     text NOT NULL,
  ron              smallint NOT NULL CHECK (ron BETWEEN 90 AND 110),
  is_premium       boolean NOT NULL DEFAULT true,
  is_legacy        boolean NOT NULL DEFAULT false,
  ethanol_free     boolean,                     -- NULL = unknown/contested (poWer 99)
  max_ethanol_pct  numeric(4,1) CHECK (max_ethanol_pct BETWEEN 0 AND 30),
  ethanol_source   text,
  is_active        boolean NOT NULL DEFAULT true,
  notes            text
);

-- ---------------------------------------------------------------------------
-- Provenance store (created before core: stations FK-references sources)
-- ---------------------------------------------------------------------------
CREATE TABLE app.sources (
  id               integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug             text NOT NULL UNIQUE,
  name             text NOT NULL,
  publisher        text,
  url              text,
  legal_basis      app.legal_basis NOT NULL,
  license_name     text,           -- exact license label surfaced as ProvenanceRef.license
  license_url      text,
  attribution_text text,           -- exact attribution string legal requires (GODL / OSM)
  terms_notes      text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app.data_provenance (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_id    integer NOT NULL REFERENCES app.sources(id),
  entity       app.provenance_entity NOT NULL,
  entity_pk    text NOT NULL,       -- station: uuid text; station_fuel: '<uuid>/<fuel_code>'
  fields       text[],              -- columns attested; NULL = whole record
  retrieved_at timestamptz NOT NULL,
  method       text NOT NULL,       -- 'official-list','locator-api','product-page-table','user-report',...
  raw_ref      text,                -- evidence pointer (Spaces key, Wayback URL, RTI reg. no.)
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Core — stations and station_fuels
-- ---------------------------------------------------------------------------
CREATE TABLE app.stations (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id           text NOT NULL UNIQUE,       -- contract Station.id, e.g. 'iocl-dl-0421'
  slug                text NOT NULL UNIQUE,        -- contract Station.slug
  brand_id            smallint NOT NULL REFERENCES app.brands(id),
  name                text NOT NULL,
  dealer_legal_name   text,                        -- INTERNAL MATCHING ONLY; never served (memo C.17)
  brand_ro_code       text,                        -- OMC outlet code; the dedup key against OMC lists
  address             text,
  pincode             text CHECK (pincode ~ '^[1-9][0-9]{5}$'),
  city_id             integer REFERENCES app.cities(id),
  state_id            smallint NOT NULL REFERENCES app.states(id),
  location            geography(Point, 4326),      -- NULLABLE: some OMC lists carry no coordinates
  location_accuracy_m integer CHECK (location_accuracy_m > 0),
  status              app.station_status NOT NULL DEFAULT 'unverified',
  merged_into_id      uuid REFERENCES app.stations(id),
  phone               text,
  amenities           jsonb,
  opening_hours       jsonb,
  primary_source_id   integer NOT NULL REFERENCES app.sources(id),  -- hard provenance floor
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'duplicate') = (merged_into_id IS NOT NULL))
);

CREATE TABLE app.station_fuels (
  station_id           uuid NOT NULL REFERENCES app.stations(id) ON DELETE CASCADE,
  fuel_type_id         smallint NOT NULL REFERENCES app.fuel_types(id),
  availability         app.availability_status NOT NULL DEFAULT 'unknown',
  first_listed_at      timestamptz NOT NULL DEFAULT now(),
  last_verified_at     timestamptz,               -- NULL = never ground-truthed (moves only on a real event)
  last_verified_method app.verification_method,
  availability_score   numeric(4,3) CHECK (availability_score BETWEEN -1 AND 1),
  confidence           numeric(4,3) NOT NULL DEFAULT 0 CHECK (confidence BETWEEN 0 AND 1),
  checkins             integer NOT NULL DEFAULT 0 CHECK (checkins >= 0),  -- StationGrade.checkins projection
  last_price_paise     integer CHECK (last_price_paise BETWEEN 5000 AND 50000),  -- authoritative-only
  last_price_at        timestamptz,
  last_price_source_id integer REFERENCES app.sources(id),  -- lets read layer rebuild Price.source/asOf
  updated_at           timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (station_id, fuel_type_id)
);

-- ---------------------------------------------------------------------------
-- Users, reports, and the append-only verification spine
-- ---------------------------------------------------------------------------
CREATE TABLE app.users (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email            citext UNIQUE,       -- single identity for magic-link + Google OAuth (nullable => tombstone)
  google_sub       text UNIQUE,
  display_name     text,
  trust_level      smallint NOT NULL DEFAULT 0 CHECK (trust_level BETWEEN 0 AND 3),
  points           integer NOT NULL DEFAULT 0,
  consent_version  text,
  consented_at     timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  last_seen_at     timestamptz,
  deleted_at       timestamptz,         -- DPDP erasure = tombstone + PII scrub
  CHECK (email IS NOT NULL OR deleted_at IS NOT NULL)
);

CREATE TABLE app.user_reports (
  id                      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id                 uuid NOT NULL REFERENCES app.users(id),
  station_id              uuid REFERENCES app.stations(id),
  fuel_type_id            smallint REFERENCES app.fuel_types(id),
  kind                    app.report_kind NOT NULL,
  availability            app.availability_status,
  price_paise             integer CHECK (price_paise BETWEEN 5000 AND 50000),  -- Phase 2 only
  reported_from           geography(Point, 4326),  -- device fix; geofence signal; scrubbed at 90d
  distance_from_station_m integer,
  payload                 jsonb,
  status                  app.moderation_status NOT NULL DEFAULT 'pending',
  reviewed_by             uuid REFERENCES app.users(id),
  reviewed_at             timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  CHECK (kind = 'new_station' OR station_id IS NOT NULL),
  CHECK (kind <> 'availability_checkin'
         OR (fuel_type_id IS NOT NULL AND availability IS NOT NULL)),
  CHECK (kind <> 'price_report' OR price_paise IS NOT NULL)
);

CREATE TABLE app.verification_history (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  station_id     uuid NOT NULL,
  fuel_type_id   smallint NOT NULL,
  method         app.verification_method NOT NULL,
  outcome        app.verification_outcome NOT NULL,
  verified_at    timestamptz NOT NULL DEFAULT now(),
  verified_by    uuid REFERENCES app.users(id),
  user_report_id bigint REFERENCES app.user_reports(id),
  source_id      integer REFERENCES app.sources(id),
  price_paise    integer CHECK (price_paise BETWEEN 5000 AND 50000),
  notes          text,
  FOREIGN KEY (station_id, fuel_type_id)
    REFERENCES app.station_fuels(station_id, fuel_type_id) ON DELETE CASCADE,
  CHECK (user_report_id IS NOT NULL OR source_id IS NOT NULL OR verified_by IS NOT NULL)
);

-- ---------------------------------------------------------------------------
-- Recency-decayed availability score (half-life 21d) + projection trigger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.sf_availability_score(
  p_station_id uuid, p_fuel_type_id smallint, p_now timestamptz DEFAULT now()
) RETURNS TABLE (score numeric, confidence numeric, sample_size integer)
LANGUAGE sql STABLE AS $$
  WITH w AS (
    SELECT
      (CASE vh.method
         WHEN 'partner_api_probe' THEN 1.0 WHEN 'field_visit' THEN 1.0
         WHEN 'moderator_desk'    THEN 0.9 WHEN 'phone_call'   THEN 0.8
         WHEN 'user_checkin'      THEN 0.7 END)
      * exp(-ln(2) * (EXTRACT(epoch FROM (p_now - vh.verified_at)) / 86400.0) / 21.0) AS weight,
      (CASE vh.outcome
         WHEN 'confirmed_available'    THEN  1.0
         WHEN 'confirmed_low_stock'    THEN  0.3
         WHEN 'confirmed_out_of_stock' THEN -1.0 END) AS value
    FROM app.verification_history vh
    WHERE vh.station_id = p_station_id AND vh.fuel_type_id = p_fuel_type_id
      AND vh.verified_at > p_now - interval '90 days'
      AND vh.outcome IN ('confirmed_available','confirmed_low_stock','confirmed_out_of_stock')
      AND vh.method  IN ('partner_api_probe','field_visit','moderator_desk','phone_call','user_checkin')
  )
  SELECT
    CASE WHEN sum(weight) > 0 THEN round((sum(weight*value)/sum(weight))::numeric, 3) END,
    round((1 - exp(-COALESCE(sum(weight), 0)))::numeric, 3),
    count(*)::int
  FROM w;
$$;

CREATE OR REPLACE FUNCTION app.apply_verification() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_score numeric; v_conf numeric;
BEGIN
  IF NEW.outcome = 'inconclusive' THEN
    RETURN NEW;  -- recorded, but does not refresh staleness or the score
  END IF;

  SELECT score, confidence INTO v_score, v_conf
  FROM app.sf_availability_score(NEW.station_id, NEW.fuel_type_id, NEW.verified_at);

  UPDATE app.station_fuels sf
     SET availability = CASE NEW.outcome
           WHEN 'confirmed_available'    THEN 'available'::app.availability_status
           WHEN 'confirmed_low_stock'    THEN 'low_stock'::app.availability_status
           WHEN 'confirmed_out_of_stock' THEN 'out_of_stock'::app.availability_status
           WHEN 'fuel_not_sold'          THEN 'discontinued'::app.availability_status
           WHEN 'station_closed'         THEN sf.availability
         END,
         last_verified_at     = NEW.verified_at,
         last_verified_method = NEW.method,
         availability_score   = v_score,
         confidence           = COALESCE(v_conf, 0),
         -- price ONLY from the authoritative live feed; crowd never sets a displayed price
         last_price_paise     = CASE WHEN NEW.method = 'partner_api_probe' AND NEW.price_paise IS NOT NULL
                                     THEN NEW.price_paise ELSE sf.last_price_paise END,
         last_price_at        = CASE WHEN NEW.method = 'partner_api_probe' AND NEW.price_paise IS NOT NULL
                                     THEN NEW.verified_at ELSE sf.last_price_at END,
         last_price_source_id = CASE WHEN NEW.method = 'partner_api_probe' AND NEW.price_paise IS NOT NULL
                                     THEN NEW.source_id ELSE sf.last_price_source_id END,
         updated_at           = now()
   WHERE sf.station_id = NEW.station_id
     AND sf.fuel_type_id = NEW.fuel_type_id
     AND (sf.last_verified_at IS NULL OR sf.last_verified_at <= NEW.verified_at);  -- ignore backfills
  RETURN NEW;
END $$;

CREATE TRIGGER trg_apply_verification
AFTER INSERT ON app.verification_history
FOR EACH ROW EXECUTE FUNCTION app.apply_verification();

-- Nightly maintenance (silence must visibly age even with no new events).
CREATE OR REPLACE FUNCTION app.recompute_availability_scores() RETURNS void
LANGUAGE sql AS $$
  UPDATE app.station_fuels sf
     SET availability_score = s.score,
         confidence         = COALESCE(s.confidence, 0),
         updated_at         = now()
  FROM   app.station_fuels t
         CROSS JOIN LATERAL app.sf_availability_score(t.station_id, t.fuel_type_id) s
  WHERE  t.station_id = sf.station_id AND t.fuel_type_id = sf.fuel_type_id
    AND  sf.availability <> 'discontinued'::app.availability_status;
$$;

-- ---------------------------------------------------------------------------
-- Reliability rollup (fulfils the brief's `ratings` entity, memo D.17) + images
-- ---------------------------------------------------------------------------
CREATE TABLE app.station_reliability (
  station_id  uuid PRIMARY KEY REFERENCES app.stations(id) ON DELETE CASCADE,
  score       smallint CHECK (score BETWEEN 0 AND 100),  -- NULL = not enough recent evidence
  sample_size integer  NOT NULL DEFAULT 0,
  computed_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION app.recompute_station_reliability() RETURNS void
LANGUAGE sql AS $$
  INSERT INTO app.station_reliability (station_id, score, sample_size, computed_at)
  SELECT DISTINCT ON (sf.station_id)
         sf.station_id,
         CASE WHEN sf.confidence >= 0.15 THEN round(50 * (sf.availability_score + 1))::smallint END,
         0, now()
  FROM   app.station_fuels sf
  JOIN   app.fuel_types ft ON ft.id = sf.fuel_type_id AND ft.is_premium AND NOT ft.is_legacy
  WHERE  sf.availability_score IS NOT NULL
  ORDER  BY sf.station_id, ft.ron DESC
  ON CONFLICT (station_id) DO UPDATE
     SET score = EXCLUDED.score, sample_size = EXCLUDED.sample_size, computed_at = EXCLUDED.computed_at;
$$;

CREATE TABLE app.images (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id     uuid REFERENCES app.stations(id) ON DELETE CASCADE,
  user_report_id bigint REFERENCES app.user_reports(id),
  uploaded_by    uuid REFERENCES app.users(id),
  kind           app.image_kind NOT NULL DEFAULT 'other',
  storage_key    text NOT NULL UNIQUE,     -- Spaces object key; originals never in the DB
  content_sha256 bytea NOT NULL,
  width_px       integer, height_px integer,
  exif_location  geography(Point, 4326),
  status         app.moderation_status NOT NULL DEFAULT 'pending',
  created_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (station_id IS NOT NULL OR user_report_id IS NOT NULL)
);

-- ---------------------------------------------------------------------------
-- Prices — city-level series with the memo price hierarchy as a schema invariant
-- ---------------------------------------------------------------------------
CREATE TABLE app.fuel_prices (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  brand_id     smallint NOT NULL REFERENCES app.brands(id),
  fuel_type_id smallint NOT NULL REFERENCES app.fuel_types(id),
  city_id      integer NOT NULL REFERENCES app.cities(id),
  price_paise  integer NOT NULL CHECK (price_paise BETWEEN 5000 AND 50000),
  effective_on date NOT NULL,
  publication  app.price_publication NOT NULL,
  source_id    integer NOT NULL REFERENCES app.sources(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (brand_id, fuel_type_id, city_id, effective_on)
);

-- The ONLY relation the app/API reads for prices; single-source figures physically cannot render.
CREATE VIEW app.fuel_prices_public AS
  SELECT * FROM app.fuel_prices
  WHERE publication IN ('authoritative', 'multi_source_confirmed');

-- ---------------------------------------------------------------------------
-- Store #2 — ODbL OSM sidecar (quarantine zone; never merged into app)
-- ---------------------------------------------------------------------------
CREATE TABLE osm.fuel_stations (
  osm_type     char(1) NOT NULL CHECK (osm_type IN ('n','w','r')),
  osm_id       bigint  NOT NULL,
  name         text,
  brand_raw    text,
  operator_raw text,
  tags         jsonb NOT NULL,
  geom         geography(Point, 4326) NOT NULL,   -- ways/relations collapsed to centroid at import
  extract_date date NOT NULL,
  imported_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (osm_type, osm_id)
);

COMMENT ON SCHEMA osm IS
  'ODbL 1.0. (c) OpenStreetMap contributors. Refreshed from Geofabrik india-latest.osm.pbf. '
  'MUST NOT be joined/merged into app.stations (Derivative Database trigger, ODbL Collective Guideline). '
  'Read-only context/basemap-density layer + runtime proximity QA only.';

-- ---------------------------------------------------------------------------
-- Store #3 — GODL government statistics (attribution mandatory; denominators only)
-- ---------------------------------------------------------------------------
CREATE TABLE gov.retail_outlet_stats (
  id                integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  scope             text NOT NULL,                  -- 'national' | 'state'
  state_id          smallint REFERENCES app.states(id),
  brand_id          smallint REFERENCES app.brands(id),
  outlet_count      integer  CHECK (outlet_count >= 0),
  premium_share_pct numeric(5,2),
  as_on             date NOT NULL,
  source_id         integer NOT NULL REFERENCES app.sources(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  CHECK ((scope = 'national') = (state_id IS NULL AND brand_id IS NULL))
);

COMMENT ON SCHEMA gov IS
  'GODL-India. Attribution mandatory. PPAC / MoPNG / data.gov.in denominators and coverage KPIs ONLY. '
  'Zero outlet-level premium data exists here (verified). Never joined into app.stations.';
