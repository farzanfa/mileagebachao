# Deploying OctaneFinder

Target: **DigitalOcean App Platform + Managed PostgreSQL, region `blr` (Bangalore / BLR1)**.
India data residency is a hard requirement (memo A.7/A.15). The app is designed so the read-only
site runs off the committed seed dataset with **zero infrastructure**; the database and secrets add
writes (check-ins, corrections, moderation), production-scale reads, and the live map.

## 0. What runs without any config

```bash
npm ci
npm run build
npm run start      # serves on :3000 from data/stations.seed.json — no DB, no secrets
```

`npm run dev` works the same way. The map view shows a "configure map" panel until
`NEXT_PUBLIC_MAP_STYLE_URL` is set; everything else (search, filters, city/station pages,
station detail, the read API) is fully functional against the seed data.

## 1. Provision

1. **Database** — DigitalOcean Managed PostgreSQL 16. After creation, enable PostGIS:
   `CREATE EXTENSION IF NOT EXISTS postgis;` (run once via the DO console or `psql`).
2. **Object storage** — a DigitalOcean Spaces bucket in `blr1` for user-uploaded photos (v1.1).
3. **Map tiles** — a Stadia Maps account (Starter, ~$20/mo). Copy your style URL.

## 2. Configure environment

Copy `.env.example` and fill in. The load-bearing ones:

| Variable | Purpose | Required for |
| --- | --- | --- |
| `DATABASE_URL` | Postgres connection string | writes, scaled reads |
| `NEXT_PUBLIC_SITE_URL` | Canonical URL (SEO, sitemap, OG) | production |
| `NEXT_PUBLIC_MAP_STYLE_URL` | Stadia/MapTiler style URL | the live map |
| `AUTH_SECRET`, `AUTH_GOOGLE_ID/SECRET`, `EMAIL_SERVER/FROM` | Auth.js sign-in | v1.1 accounts |
| `ADMIN_EMAILS` | comma-separated moderator emails | admin console |
| `S3_*` | DO Spaces credentials | photo uploads |

## 3. Migrate + seed

```bash
DATABASE_URL=... npm run migrate   # applies migrations/*.sql in order (enums, tables, PostGIS, GiST)
DATABASE_URL=... npm run seed      # idempotent upsert of data/stations.seed.json + provenance ledger
```

## 4. Deploy

```bash
doctl apps create --spec .do/app.yaml
```

Edit `.do/app.yaml` first: set your GitHub repo, then add the `SECRET`-typed env values in the
App Platform dashboard (they are intentionally blank in the spec). The health check hits
`/api/v1/health`, which reports DB connectivity.

### Docker (any host)

```bash
docker compose up --build      # app + postgis:16-3.4; runs migrate + seed on start
```

## 5. Cost (from the spec)

- **Launch (≤25k MAU): ≈ $65/mo** — Stadia $20, app instance ~$18, managed Postgres $15,
  Spaces $5, domain/email ~$5. Cloudflare / Sentry / Plausible on free tiers.
- **500k MAU: ≈ $600/mo planning figure.** If tile spend exceeds $300/mo for two consecutive
  months, execute the Protomaps self-host fallback (see `docs/ARCHITECTURE.md`) to cut tiles to
  <$40/mo. Client-side search means query volume is never a cost line.

## 6. Data freshness (see `docs/RUNBOOK.md`)

Schedule the pipeline (cron): BPCL poll daily, HPCL diff monthly, IOCL sitemap monthly, RTI
quarterly. Every raw response is snapshotted with its retrieval date. The BPCL feed is never a
runtime dependency — if it closes, community check-ins carry freshness and RTI compels the list.
