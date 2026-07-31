# OctaneFinder Data Pipeline

Python 3.12 acquisition pipeline that seeds and keeps fresh the proprietary
premium-outlet register — the ~300 (planning 300–400) Indian retail outlets that
stock a **100-RON, ethanol-free (E0)** grade: IndianOil **XP100**, HPCL
**poWer 100**, BPCL **Speed 100** (plus the legacy **poWer 99** / **Speed 97**).

It implements the doctrine from the binding decision memo (§C) and the data-source
research memo (`final-datasources.md` §2):

> **official lists seed → open data enriches → the crowd verifies → polling + RTI keep it fresh.**

Everything here is **runnable, polite, and legally conservative**. No script
circumvents a WAF, reverse-engineers a mobile-app private API, bulk-stores Google
Places data, or scrapes a community compilation. Every module is import-safe and
passes `python -m py_compile`.

---

## Design principles

| Principle | How it is enforced |
|---|---|
| **Identify ourselves, obey `robots.txt`** | `common.PoliteSession` sends an identified User-Agent, honours `robots.txt` (and `Crawl-delay`), and rate-limits per host. The robots check is **never** disabled to reach gated content (IT Act ss.43/66; memo C.12). |
| **Snapshot before parsing** | Every raw response is written to the object store with a provenance sidecar (`common.snapshot`) *before* it is parsed — the legal evidence locker (memo A.6; DB §6.6 `data_provenance.raw_ref`). |
| **Degrade, don't break** | Unofficial endpoints are flaky by nature. Network failures are caught and logged; a run reports partial success and exits non-zero rather than crashing. The BPCL API is **never a runtime dependency**. |
| **Facts only, never a listing’s expression** | We re-key uncopyrightable facts (*EBC v. D.B. Modak*), never copy a source's creative selection/arrangement wholesale. |
| **Official ≠ verified** | A listing seeds a station as `availability="unknown"`, `lastVerifiedDays=null`, `status="official-listed"`. Only a later check-in moves `lastVerified` (memo C.10). |
| **Price only when authoritative** | The single authoritative price is BPCL **Speed 100 ₹169.00**. Every other grade emits no price — single-source figures are never rendered (memo §0.4). |
| **No dealer-proprietor names** | The "M/s …" legal name is kept only in an internal `_dealerLegalName` field for matching; it is never the public `name` and never served (DPDP, memo C.17). |
| **Logically separated stores** | This pipeline populates only the **proprietary register**. The ODbL OSM layer and GODL government stats live in their own schemas and are **never row-merged** (memo C.14). |

---

## Modules

| File | Role |
|---|---|
| `common.py` | Config (`PipelineConfig`/`get_config`), polite HTTP (`PoliteSession`, robots policy, retry/backoff), snapshotting (`snapshot`, local + optional S3/Spaces object store), logging, JSON I/O. Infra only; import-safe with the stdlib alone. |
| `poll_bpcl.py` | Polls `api.cep.bpcl.in/.../rolocators` on a **hex grid** (or metro centroids), snapshots **every** raw response, and extracts deduped Speed 100 / Speed 97 outlets. |
| `diff_hpcl.py` | Fetches the HPCL **poWer 99 / poWer 100** product pages, snapshots the HTML, parses the "Selling Outlets" table (stdlib parser; handles tables wrapped in HTML comments), and **diffs** against last month's parse with a change alert. |
| `crawl_iocl_sitemap.py` | Parses the captured `iocl.com/xp100` RO list, then politely crawls the `locator.iocl.com` **sitemap** to join RO code → address/coords (JSON-LD + meta extraction). The `iocl.com` WAF is left alone (human-in-browser + RTI, off-pipeline). |
| `normalize.py` | Maps every raw source into the **canonical station schema** (the `Station` shape in `src/lib/types.ts`). Owns the domain reference maps (grades, states, provenance sources), slug/id/status derivation, and validation. Rows without coordinates go to `pending_geocode` (never fabricated). |
| `load.py` | Upserts the canonical stations into the production **PostgreSQL + PostGIS** schema (`brands`/`states`/`cities`/`fuel_types`/`sources`/`stations`/`station_fuels`) and appends **`data_provenance`** rows. Idempotent core; graceful when the DB/driver is absent (`--dry-run` needs neither). |

### Data flow

```
                 SEED                          ENRICH            NORMALIZE          LOAD
 poll_bpcl.py  ─ bpcl-harvest.json ─┐
 diff_hpcl.py  ─ hpcl-harvest.json ─┤                                            ┌─ Postgres
 crawl_iocl_…  ─ xp100 rows + ──────┼─ iocl-geo.json ─┐                          │  (app schema)
                geo join            │  hpcl geocode ──┼─▶ normalize.py ──────────┤
                                    └─────────────────┘   stations.normalized… ──┴─ data_provenance
```

Every step writes to `$PIPELINE_OUT_DIR` (default `pipeline/_out/`) and every raw
capture to `$SNAPSHOT_DIR` (default `pipeline/_snapshots/`). Neither directory is a
build input — add both to `.gitignore` (the `pipeline/__pycache__/` entry is
already present). The app builds from the committed `data/stations.seed.json`,
which is owned by the FOUNDATION builder; **this pipeline never writes that file.**

---

## Install & run

```bash
cd pipeline
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt          # all deps optional; stdlib works too
```

```bash
# 1) SEED — BPCL (metro centroids is the cheap default; grid for a full sweep)
python poll_bpcl.py --mode cities --out _out/bpcl-harvest.json
python poll_bpcl.py --mode grid --spacing-km 25 --max-cells 2000   # full national sweep

# 2) SEED — HPCL product-page tables (+ monthly diff alert)
python diff_hpcl.py --grade all --out _out/hpcl-harvest.json

# 3) SEED/ENRICH — IOCL: parse the captured XP100 list, then join geo via the locator sitemap
python crawl_iocl_sitemap.py \
    --xp100-list ../_snapshots/iocl/xp100-ro-list.txt \
    --emit-xp100 _out/iocl-xp100.json \
    --out _out/iocl-geo.json

# 4) NORMALIZE — fold all harvests into the canonical schema (keep internal fields for load)
python normalize.py \
    --bpcl _out/bpcl-harvest.json \
    --hpcl _out/hpcl-harvest.json  --hpcl-geocode _out/hpcl-geocode.json \
    --iocl _out/iocl-xp100.json    --iocl-geo _out/iocl-geo.json \
    --keep-internal --out _out/stations.normalized.json

# 5) LOAD — upsert into Postgres with provenance (needs DATABASE_URL + migrations applied)
python load.py _out/stations.normalized.json          # or: --dry-run to preview
```

`normalize.py` emits `pending_geocode.json` for IOCL/HPCL rows that still lack
coordinates (hand-geocode the ~51 HPCL rows once; join IOCL via the sitemap crawl,
H.1-gated, else manual-geocode the 220 rows ~2 person-days — memo A.13).

### Environment variables

| Var | Default | Meaning |
|---|---|---|
| `SNAPSHOT_DIR` | `pipeline/_snapshots` | Raw-capture object store (local dir). |
| `PIPELINE_OUT_DIR` | `pipeline/_out` | Harvest / normalized outputs. |
| `DATABASE_URL` | *(unset)* | Postgres DSN for `load.py`. Unset ⇒ `load.py` exits 3 with a clear message. |
| `PIPELINE_CONTACT` | `ops@octanefinder.example` | Contact embedded in the User-Agent. |
| `PIPELINE_UA` | derived | Full User-Agent override. |
| `HTTP_MIN_INTERVAL` | `1.0` | Min seconds between requests to a host. |
| `HTTP_MAX_RETRIES` | `3` | Retries on 429/5xx/transport errors. |
| `HTTP_TIMEOUT` | `30` | Per-request timeout (s). |
| `RESPECT_ROBOTS` | `1` | Robots enforcement (leave on). |
| `S3_ENDPOINT` / `S3_REGION` / `S3_BUCKET` / `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | *(unset)* | DO Spaces / S3 snapshot target (needs `boto3`); falls back to the local dir. |
| `PIPELINE_LOG_LEVEL` | `INFO` | Logging verbosity. |

---

## Scheduler note (cron cadences)

Cadences implement the KEEP-FRESH stage (`final-datasources.md` §2.3, stage 4).
All times **IST**; the poll runs off-peak. Run under a service account whose
`PIPELINE_CONTACT` is a monitored inbox, and alert on any non-zero exit.

```cron
# ┌ min  ┌ hour ┌ dom ┌ mon ┌ dow   (Asia/Kolkata)   CMD
# DAILY — BPCL availability + Speed 100 price delta (prices revise daily, off-peak)
  15      3      *     *     *   cd /srv/octanefinder/pipeline && \
        .venv/bin/python poll_bpcl.py --mode cities --out _out/bpcl-harvest.json && \
        .venv/bin/python normalize.py --bpcl _out/bpcl-harvest.json --keep-internal \
              --out _out/stations.bpcl.json && \
        .venv/bin/python load.py _out/stations.bpcl.json

# MONTHLY — HPCL product-page diff + IOCL locator re-crawl (1st of month, staggered)
  30      4      1     *     *   cd /srv/octanefinder/pipeline && \
        .venv/bin/python diff_hpcl.py --grade all --out _out/hpcl-harvest.json
  30      5      1     *     *   cd /srv/octanefinder/pipeline && \
        .venv/bin/python crawl_iocl_sitemap.py --xp100-json _out/iocl-xp100.json \
              --out _out/iocl-geo.json --limit 400

# QUARTERLY (operational reminder — the tasks below are human, not cron)
#   • Human-in-browser recapture of iocl.com/xp100 (WAF; no bot). Save to $SNAPSHOT_DIR,
#     then: crawl_iocl_sitemap.py --xp100-list <file> --emit-xp100 _out/iocl-xp100.json
#   • File RTI Act 2005 requests (₹10, 30-day clock) to IOCL / BPCL / HPCL CPIOs.
#   • Full national BPCL grid sweep: poll_bpcl.py --mode grid --spacing-km 25.
#
# CONTINUOUS — geofenced check-ins decay the availability score; handled by the app
#   write path, not this batch pipeline (a check-in is the ONLY event that moves
#   last_verified — memo C.10).
```

Recommended systemd-timer equivalents are fine too; the cron table above is the
canonical cadence spec. Full operational detail belongs in `docs/RUNBOOK.md`
(owned by the DOCS builder); this note is the pipeline-local source of truth for
*what runs when*.

---

## What this pipeline will **not** do (binding prohibitions, memo C.11–C.18)

- Bypass the `iocl.com` Sucuri WAF with automated tooling (human-in-browser + RTI only).
- Reverse-engineer OMC mobile-app private APIs (IndianOil ONE / HelloBPCL / HP Pay).
- Bulk-store Google Places data (Maps ToS §3.2.3 / §14.2).
- Row-merge the OSM layer into the proprietary register (ODbL share-alike trigger).
- Scrape e20petrol.in / Team-BHP / any community compilation (partnership only).
- Publish single-source prices, or display dealer-proprietor personal names.
