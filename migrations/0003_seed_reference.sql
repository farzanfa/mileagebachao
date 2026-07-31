-- OctaneFinder — 0003_seed_reference.sql
-- Wave 0 reference data (spec §6.15): states/UTs, brands, the 5 fuel_types, the initial `sources`
-- registry, and the GODL national denominator. Idempotent (re-runs on every deploy). The register
-- itself (stations/station_fuels/provenance ledger) is loaded by scripts/seed.ts from the committed
-- data/stations.seed.json; cities are created lazily there.

-- States / UTs — ISO 3166-2:IN --------------------------------------------
INSERT INTO app.states (iso_code, name, is_union_territory) VALUES
  ('IN-AP','Andhra Pradesh',false), ('IN-AR','Arunachal Pradesh',false),
  ('IN-AS','Assam',false), ('IN-BR','Bihar',false), ('IN-CT','Chhattisgarh',false),
  ('IN-GA','Goa',false), ('IN-GJ','Gujarat',false), ('IN-HR','Haryana',false),
  ('IN-HP','Himachal Pradesh',false), ('IN-JH','Jharkhand',false), ('IN-KA','Karnataka',false),
  ('IN-KL','Kerala',false), ('IN-MP','Madhya Pradesh',false), ('IN-MH','Maharashtra',false),
  ('IN-MN','Manipur',false), ('IN-ML','Meghalaya',false), ('IN-MZ','Mizoram',false),
  ('IN-NL','Nagaland',false), ('IN-OR','Odisha',false), ('IN-PB','Punjab',false),
  ('IN-RJ','Rajasthan',false), ('IN-SK','Sikkim',false), ('IN-TN','Tamil Nadu',false),
  ('IN-TG','Telangana',false), ('IN-TR','Tripura',false), ('IN-UP','Uttar Pradesh',false),
  ('IN-UT','Uttarakhand',false), ('IN-WB','West Bengal',false),
  ('IN-AN','Andaman and Nicobar Islands',true), ('IN-CH','Chandigarh',true),
  ('IN-DH','Dadra and Nagar Haveli and Daman and Diu',true), ('IN-DL','Delhi',true),
  ('IN-JK','Jammu and Kashmir',true), ('IN-LA','Ladakh',true),
  ('IN-LD','Lakshadweep',true), ('IN-PY','Puducherry',true)
ON CONFLICT (iso_code) DO UPDATE
  SET name = EXCLUDED.name, is_union_territory = EXCLUDED.is_union_territory;

-- Brands (IOCL/BPCL/HPCL carry in-scope grades; the rest exist for OSM brand-string normalization).
INSERT INTO app.brands (code, name, is_psu) VALUES
  ('IOCL','IndianOil',true), ('BPCL','Bharat Petroleum',true), ('HPCL','Hindustan Petroleum',true),
  ('NAYARA','Nayara Energy',false), ('JIOBP','Jio-bp',false), ('SHELL','Shell',false)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, is_psu = EXCLUDED.is_psu;

-- Fuel types — the product truth as of 2026-07-28 (spec §6.5). `grade_name` = exact contract GradeName.
INSERT INTO app.fuel_types
  (code, grade_name, brand_id, display_name, ron, is_premium, is_legacy, ethanol_free, max_ethanol_pct, ethanol_source)
VALUES
  ('XP100','XP100', (SELECT id FROM app.brands WHERE code='IOCL'), 'IndianOil XP100', 100, true, false, true, 0,
    'E0 per Lok Sabha reply 23-Jul-2026; IOCL RTI'),
  ('POWER100','poWer 100', (SELECT id FROM app.brands WHERE code='HPCL'), 'HPCL poWer 100', 100, true, false, true, 0,
    'E0 per Govt of India (Lok Sabha, 23-Jul-2026); single 4%-ethanol social claim recorded in provenance, never displayed'),
  ('SPEED100','Speed 100', (SELECT id FROM app.brands WHERE code='BPCL'), 'BPCL Speed 100', 100, true, false, true, 0,
    'Independently tested E0; live API code "SPEED 100 BS IV"'),
  ('POWER99','poWer 99', (SELECT id FROM app.brands WHERE code='HPCL'), 'HPCL poWer 99', 99, true, true, NULL, NULL,
    'Ethanol status unknown; no primary source on blending'),
  ('SPEED97','Speed 97', (SELECT id FROM app.brands WHERE code='BPCL'), 'BPCL Speed 97', 97, true, true, false, 20.0,
    'E20; phase-out, 1 known Delhi outlet, 0 in Mumbai/Bengaluru/Chennai (BPCL API, 2026-07-28)')
ON CONFLICT (code) DO UPDATE SET
  grade_name = EXCLUDED.grade_name, brand_id = EXCLUDED.brand_id, display_name = EXCLUDED.display_name,
  ron = EXCLUDED.ron, is_premium = EXCLUDED.is_premium, is_legacy = EXCLUDED.is_legacy,
  ethanol_free = EXCLUDED.ethanol_free, max_ethanol_pct = EXCLUDED.max_ethanol_pct,
  ethanol_source = EXCLUDED.ethanol_source;

-- Sources registry. Slugs are slugify(name) so scripts/seed.ts (which upserts by the same slug)
-- dedups onto these rows rather than creating parallel ones.
INSERT INTO app.sources (slug, name, publisher, url, legal_basis, license_name, license_url, attribution_text, terms_notes)
VALUES
  ('iocl-xp100-official-retail-outlet-list','IOCL XP100 official retail-outlet list','Indian Oil Corporation Ltd',
    'https://iocl.com/xp100','omc_public_page','facts:EBC-v-Modak',NULL,NULL,
    'Human-in-browser capture, no WAF circumvention; facts (uncopyrightable) only'),
  ('bpcl-locator-api','BPCL locator API','Bharat Petroleum Corporation Ltd',
    'https://api.cep.bpcl.in','unofficial_api','facts:EBC-v-Modak',NULL,NULL,
    'Undocumented endpoint; revocable; never a runtime dependency; every response snapshotted'),
  ('hpcl-power-product-page-outlet-table','HPCL poWer product-page outlet table','Hindustan Petroleum Corporation Ltd',
    'https://www.hindustanpetroleum.com','omc_public_page','facts:EBC-v-Modak',NULL,NULL,
    'Monthly parse with diff alert; screenshots kept as raw_ref'),
  ('crowd-firstparty','OctaneFinder community check-ins','OctaneFinder',NULL,'user_submission',
    'OctaneFinder ToS contribution licence',NULL,NULL,'Geofenced, post-moderation'),
  ('osm-geofabrik-india','OpenStreetMap (Geofabrik india-latest)','OpenStreetMap contributors',
    'https://download.geofabrik.de/asia/india.html','odbl_osm','ODbL 1.0','https://opendatacommons.org/licenses/odbl/1-0/',
    '(c) OpenStreetMap contributors','Lives only in osm schema; never merged into app'),
  ('ppac-ready-reckoner','PPAC Ready Reckoner FY2025-26','Petroleum Planning & Analysis Cell',
    'https://ppac.gov.in','godl_india','GODL-India','https://data.gov.in/government-open-data-license-india',
    'Source: Petroleum Planning & Analysis Cell (PPAC), Government of India — GODL-India','Denominators only')
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, publisher = EXCLUDED.publisher, url = EXCLUDED.url,
  legal_basis = EXCLUDED.legal_basis, license_name = EXCLUDED.license_name, license_url = EXCLUDED.license_url,
  attribution_text = EXCLUDED.attribution_text, terms_notes = EXCLUDED.terms_notes;

-- GODL national denominator (spec §6.13): 1,03,023 retail outlets, ~0.5% premium share.
INSERT INTO gov.retail_outlet_stats (scope, state_id, brand_id, outlet_count, premium_share_pct, as_on, source_id)
SELECT 'national', NULL, NULL, 103023, 0.50, DATE '2026-04-01',
       (SELECT id FROM app.sources WHERE slug = 'ppac-ready-reckoner')
WHERE NOT EXISTS (
  SELECT 1 FROM gov.retail_outlet_stats WHERE scope = 'national' AND as_on = DATE '2026-04-01'
);
