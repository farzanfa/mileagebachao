# Runbook

Operational guide for keeping OctaneFinder's data fresh and the service healthy. The data pipeline
(`pipeline/*.py`) is **out-of-band**: it runs on system cron on the app droplet, writes to
PostgreSQL, and is *never* part of the request path. The app itself keeps serving last-known-good
data (or the committed seed) even if the entire pipeline is down.

**Doctrine:** official lists *seed* → open data *enriches* → the crowd *verifies* → polling + RTI
*keep fresh*. Every record carries `source[]`, `first_seen`, `last_verified`, `verification_method`.
**A community check-in is the only event that moves `last_verified`.**

---

## 1. Data-refresh cadences

Each stage is `capture → normalize → validate → load`. Every raw response is snapshotted to object
storage **before** parsing (`raw/{source}/{yyyy-mm-dd}/{sha256}.{json|html}`), so a parser bug never
costs data and every historical state is replayable.

| Cadence | Source | Script(s) | What it refreshes | Notes |
|---|---|---|---|---|
| **Daily** (off-peak) | **BPCL** locator API | `poll_bpcl.py` → `normalize.py` → `load.py` | Speed 100 / Speed 97 availability + the **authoritative Speed 100 price (₹169.00/L)** | Unofficial, no SLA. Polite hex-grid sweep, identified UA, `robots.txt` obeyed. **Never a runtime dependency** — see §3 failover. |
| **Daily** | **OSM** Geofabrik India extract | `normalize.py` (osm mode) → `load.py` | `osm.fuel_stations` geometry + brand-normalization context | ODbL layer, kept separate; suggestions only, never row-merged into `app.*`. |
| **Monthly** | **HPCL** poWer 99 / poWer 100 product pages | `diff_hpcl.py` → `normalize.py` → `load.py` | poWer 100 / poWer 99 outlet lists (~51 rows) | Static HTML tables; monthly **diff alert**. Rows are hand-geocoded once. No HPCL price ever renders (no authoritative source). |
| **Monthly** | **IOCL** `locator.iocl.com` sitemap | `crawl_iocl_sitemap.py` → `normalize.py` → `load.py` | RO-code → address / lat-lon geocode join for XP100 outlets | Robots-permitted, rate-limited, identified UA. The locator has **no** XP100 filter; the crawl only supplies geometry. |
| **Quarterly** | **IOCL** `iocl.com/xp100` RO list | human-in-browser recapture → `normalize.py` → `load.py` | The official 220-row XP100 RO list | Behind a WAF whose ToU bars automation — recapture is **manual** (the page is public, no login). We never circumvent the WAF. |
| **Quarterly** | **RTI filings** to IOCL / HPCL / BPCL CPIOs | manual | Authoritative, compellable refresh of each OMC's premium list | ₹10 per filing, 30-day statutory clock. The unimpeachable source of record. |
| **Quarterly** | **PPAC / data.gov.in** | `normalize.py` (gov mode) → `load.py` | `gov.retail_outlet_stats` denominators / coverage KPIs | GODL-India; drives the attribution/stats pages. No outlet-level premium data. |
| **Continuous** (v1.1) | **Community check-ins** | live via `POST /api/v1/checkins` | `app.verification_history`; decays availability toward `stale`/`unknown` | The durable moat. The only event that advances `last_verified`. |

### Cron sketch (app droplet)

```cron
# min hour dom mon dow   command  (all run as the app user, cwd = /app/pipeline)
   30   2   *   *   *     python3 poll_bpcl.py && python3 normalize.py && python3 load.py   # BPCL + OSM daily, off-peak
   0    3   1   *   *     python3 diff_hpcl.py && python3 normalize.py && python3 load.py   # HPCL monthly
   0    4   1   *   *     python3 crawl_iocl_sitemap.py && python3 normalize.py && python3 load.py  # IOCL geo monthly
```

Quarterly IOCL recapture, RTI filings, and the PPAC refresh are **calendar tasks with a human
owner**, not cron jobs. Track them in the team calendar with the RTI 30-day clock.

### After every load

1. `load.py` writes an append-only `app.data_provenance` row per record per run (traceability).
2. **Validation gates** (in `normalize.py` / `validate`): a price publishes only if **authoritative**
   (currently only the BPCL API). Any single-source or out-of-band price (outside ₹140–₹200/L) is
   quarantined and never rendered. Any run changing **> 20%** of a source's records is **auto-held
   for human review** — cheap insurance against an upstream redesign silently poisoning the set.
3. **Publish**: rebuild the client JSON artifact + search index (`npm run build:index`), purge the
   affected exact URLs at Cloudflare, and ping Next.js on-demand ISR revalidation for the changed
   station/city pages.

---

## 2. Health & routine checks

- **Liveness / DB probe:** `GET /api/v1/health` → `{ data: { status: "ok", db: boolean, ts } }`.
  `db: false` means `DATABASE_URL` is unset/unreachable — the app is serving **seed fallback data**,
  which is correct-but-stale; investigate the DB, don't panic the read path.
- **Migrations:** `npm run migrate` is idempotent and forward-only (applied versions tracked in
  `public.schema_migrations`). Safe to re-run on every deploy.
- **Seed:** `npm run seed` upserts `data/stations.seed.json`. It writes state directly (not via the
  event log), so **do not run it against a production DB that already carries live check-ins** — it
  would overwrite crowd-verified `last_verified` values.

---

## 3. Incident response

General order of operations: **confirm blast radius → stabilise the read path → fix the source →
backfill → post-mortem.** The read path degrades to last-known-good (or seed) by design, so most
"incidents" are freshness incidents, not outages.

### 3.1 The BPCL feed degrades — failover to check-ins

The BPCL locator API is our best data asset *and* our most fragile: no developer program, no ToS, no
SLA. It can gain auth or vanish without notice. The architecture treats this as a **when, not if**.

**Symptoms:** `poll_bpcl.py` exits non-zero (network error, `robots.txt` now disallows, HTTP 401/403,
endpoint 404), or the daily diff shows a > 20% drop and is auto-held.

**Response:**

1. **Do not retry with evasive tooling.** We never circumvent access controls or `robots.txt`
   (IT Act ss.43/66). If the endpoint is gone or gated, the poll simply stops.
2. **The read path is already safe.** Because every field carries `source[]` + `captured_at` and the
   app serves last-known-good, existing Speed 100 outlets keep rendering with their last BPCL data.
   Freshness on those rows begins to **decay naturally** toward `stale`/`unknown` — exactly the
   intended signal.
3. **Failover authority to the crowd.** From v1.1, Speed 100 availability is carried by community
   check-ins (`POST /api/v1/checkins`), which are our own data with no third-party dependency. This
   is the durable layer the whole verification loop exists to provide. No code change is required —
   the score simply stops receiving BPCL confirmations and starts relying on check-ins.
4. **The Speed 100 price freezes.** ₹169.00/L was BPCL-authoritative; if the feed is gone, the price
   stops updating but keeps its `asOf` date so users see it is aging. Do **not** substitute a
   non-authoritative price — showing an unverifiable price is the misinformation we exist to correct.
5. **Escalate the source.** File / follow up the formal-access request to BPCL Corporate
   Communications; fall back to the quarterly RTI as the authoritative refresh.
6. **Recovery:** when the feed returns, run `poll_bpcl.py` normally; the next load reconciles and
   re-advances `sources`/`status` (but not `last_verified`, which only check-ins move).

### 3.2 IOCL WAF blocks the geocode crawl

`crawl_iocl_sitemap.py` fails or the sitemap 307s. **Response:** do not defeat the WAF. XP100 outlet
*existence* is unaffected (it comes from the quarterly RO-list recapture + RTI, not the crawl); only
new-outlet *geocoding* stalls. Fallback = **manual geocoding of the affected rows** (~2 person-days
for the full 220). Existing coordinates keep serving.

### 3.3 A source parser breaks after an upstream redesign

The > 20% auto-hold catches this. **Response:** the raw snapshot is already in object storage — fix
the parser as a pure function over the stored snapshot, re-run `normalize.py` against it, and
compare the diff before loading. No data is lost because parsing is replayable.

### 3.4 Database is down / unreachable

`GET /api/v1/health` shows `db: false`. **Response:** reads continue from seed JSON (stale but
correct); **writes return `503 db_unavailable`** and the UI should surface a "contributions
temporarily unavailable" state. Restore from DO managed-Postgres automated backups (RPO ≤ 24 h; PITR
tighter). The deeper replay source is the Spaces raw-snapshot archive.

### 3.5 Object storage (Spaces) unavailable

`POST /api/v1/images` returns `503 s3_unavailable` — photo uploads pause; everything else is
unaffected. New raw snapshots buffer to the pipeline's local snapshot directory until Spaces
returns.

### 3.6 Map tiles fail / tile spend spikes

If Stadia is unreachable, the map falls back to its "configure map" state; the list/search/detail
views are fully usable without tiles. If tile spend exceeds **$300/mo for two consecutive months**,
execute the pre-approved migration to a Protomaps PMTiles archive on Cloudflare R2 + a Worker — a
one-line MapLibre style-URL swap, not a data migration. See [DEPLOY.md](DEPLOY.md).

---

## 4. Data-integrity invariants (never violate)

- `last_verified` moves **only** on a community check-in.
- A price renders **only** when authoritative (currently only BPCL Speed 100 ₹169.00/L).
- Stations never field-confirmed show the **"Unverified — official listing, not yet field-confirmed"**
  badge.
- `app.*` and `osm.*` are **never row-merged** (ODbL share-alike boundary).
- No `app.stations` row carries a dealer-proprietor name (DPDP).
- Every served fact traces to a `data_provenance` row (see [DATA-PROVENANCE.md](DATA-PROVENANCE.md)).
