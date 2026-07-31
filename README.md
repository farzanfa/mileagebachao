# OctaneFinder

**India's ethanol-free (E0) & 100-octane fuel finder.**

OctaneFinder is a production web app that helps drivers find petrol pumps stocking
**ethanol-free (E0), 100-octane (100 RON) premium fuel** in India — and, crucially, tells them
whether that fuel was *actually seen in stock recently*, not just whether the pump is on an
official list.

Three first-class grades are tracked, all **100 RON and ethanol-free (E0)**:

| Grade | Brand | RON | Ethanol |
|---|---|---|---|
| **XP100** | IndianOil (IOCL) | 100 | E0 |
| **poWer 100** | HPCL | 100 | E0 |
| **Speed 100** | BPCL | 100 | E0 |

Two legacy grades are tracked but always labelled *legacy*: **poWer 99** (HPCL, 99 RON, ethanol
status unknown) and **Speed 97** (BPCL, 97 RON, E20).

---

## Why this exists — the E0 / 100-octane premise

India's petrol has moved to **E20** (20% ethanol) nationwide. Ethanol lowers energy content, can
attack fuel-system components in vehicles never designed for it, and is unavoidable in ordinary
pump petrol. The only mainstream way to buy **ethanol-free** petrol in India today is a premium
100-octane grade — XP100, poWer 100, or Speed 100 — and those are sold at only **~300 outlets
nationwide** (planning range 300–400), across ~45 cities.

So the hard problem is **not** "where are the petrol pumps" (India has ~1,03,000 retail outlets).
It is: *which specific outlet stocks a 100-RON / E0 grade, and did it actually have it this week?*
Premium fuel is ~0.5% of petrol sales and stock-outs are the real pain point. OctaneFinder is built
around **freshness and field-verification**, copying PlugShare's availability model rather than a
static directory:

- Positioning leads with **ethanol-free (E0)**; octane is the supporting reason.
- **Price is shown only when authoritative.** In the seed dataset only **Speed 100** has an
  authoritative price — **₹169.00/L, source "BPCL locator API", asOf 2026-07-28**. Every other
  grade deliberately shows *no* price rather than an unverifiable one.
- Any station whose grades were never field-confirmed carries an **"Unverified — official listing,
  not yet field-confirmed"** badge.
- A station's `lastVerified` timestamp is moved **only** by a community check-in — never by a scrape
  or an official-list refresh.

---

## Quickstart (zero infrastructure)

The app is designed to **build and run with no database and no secrets.** Read paths fall back to a
committed seed dataset (`data/stations.seed.json`); write paths (check-ins, corrections, moderation)
return `503 db_unavailable` until a database is configured.

```bash
npm install
cp .env.example .env.local     # every value is optional; defaults are fine
npm run dev                    # http://localhost:3000
```

That's it — the landing page, city pages, station pages, search, filters, and the map (in
"configure map" state until a tile style URL is set) all work against the seed JSON.

> **Node ≥ 20** is required (`"engines": { "node": ">=20" }`). Package manager is **npm**
> (`package-lock.json` is committed).

---

## Full setup with PostgreSQL

The database is the source of truth for **writes** (check-ins, corrections, moderation) and for
production-scale reads. It is a single **PostgreSQL 16 + PostGIS** instance holding three
**logically separated schemas** (`app`, `osm`, `gov`) that are never row-merged — see
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

```bash
# 1. Start Postgres 16 + PostGIS locally (see docker-compose.yml).
docker compose up -d

# 2. Point the app at it (matches the docker-compose defaults).
#    In .env.local:
#    DATABASE_URL=postgres://octane:octane@localhost:5432/octanefinder

# 3. Create the schema (idempotent; forward-only; tracked in public.schema_migrations).
npm run migrate

# 4. Load the seed register + provenance ledger from data/stations.seed.json.
npm run seed

# 5. Run.
npm run dev
```

With `DATABASE_URL` set, the read layer transparently switches from the seed JSON to the
`app.*` schema; nothing else in the app changes. Unset it again and the app falls back to the seed.

### Optional integrations (all degrade gracefully when unset)

| Feature | Env vars | Behaviour when unset |
|---|---|---|
| Interactive map tiles | `NEXT_PUBLIC_MAP_STYLE_URL` (Stadia / MapTiler style URL) | Map renders a "configure map" placeholder |
| Sign-in (check-ins, moderation) | `AUTH_SECRET`, `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`, `EMAIL_SERVER`/`EMAIL_FROM` | Browsing is anonymous; check-in/moderation routes return 401/403 |
| Photo uploads | `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` (DO Spaces) | `POST /api/v1/images` returns `503 s3_unavailable` |
| Admin moderation | `ADMIN_EMAILS` (comma-separated allow-list) | No one is granted the admin role |

See [`.env.example`](.env.example) for the full annotated list.

---

## Scripts

| Script | Command | Purpose |
|---|---|---|
| `npm run dev` | `next dev` | Local dev server with HMR |
| `npm run build` | `next build` | Production build (passes with no DB / no secrets) |
| `npm run start` | `next start` | Serve the production build |
| `npm run lint` | `next lint` | ESLint (`eslint-config-next`) |
| `npm run typecheck` | `tsc --noEmit` | TypeScript strict typecheck |
| `npm run test` | `vitest run` | Unit tests (`tests/*.test.ts`) |
| `npm run test:e2e` | `playwright test` | End-to-end smoke tests (`e2e/*.spec.ts`) |
| `npm run migrate` | `tsx scripts/migrate.ts` | Apply `migrations/*.sql` in order (requires `DATABASE_URL`) |
| `npm run seed` | `tsx scripts/seed.ts` | Load `data/stations.seed.json` into the register (requires `DATABASE_URL`) |
| `npm run build:index` | `tsx scripts/build-search-index.ts` | Build the client MiniSearch index artifact |

The Python data pipeline (`pipeline/*.py`) runs out-of-band on cron, not as part of the app — see
[docs/RUNBOOK.md](docs/RUNBOOK.md) and `pipeline/README.md`.

---

## Project structure

```
data/                     Committed reference + seed JSON (the no-DB read source)
  brands.json  grades.json  origins.json  stations.seed.json
migrations/               PostgreSQL 16 + PostGIS schema (forward-only SQL)
  0001_init.sql  0002_indexes.sql  0003_seed_reference.sql
scripts/                  Ops scripts run via tsx (migrate, seed, build:index)
pipeline/                 Python 3.12 ingestion pipeline (cron, out-of-band)
src/
  app/                    Next.js App Router
    page.tsx              Landing
    map/page.tsx          Interactive map + list + filters (client)
    [city]/page.tsx       City SEO page
    station/[id]/page.tsx Station detail SEO page
    legal|privacy|terms|attribution|about/  Static content pages
    sitemap.ts  robots.ts
    api/v1/               Route Handlers (the thin JSON API)
    admin/page.tsx        Moderation UI
  lib/                    types, env, db, data, geo, freshness, search, api,
                          validation, ratelimit, auth, constants, queries/*
  components/             Header, Filters, StationList/Card/Detail, GradeTag,
                          FreshnessBadge, BrandChip, map/MapLibreMap, AppShell, ui/*
  styles/tokens.css       Design tokens (light + dark)
docs/                     ARCHITECTURE, RUNBOOK, DEPLOY, CONTRIBUTING, DATA-PROVENANCE
tests/  e2e/              Vitest unit tests + Playwright smoke tests
```

Path alias: `@/*` → `src/*`. TypeScript is strict with `noUncheckedIndexedAccess`.

---

## Tech stack (short version)

Next.js 15 (App Router, React 19, SSR/SSG) · TypeScript (strict) · Tailwind CSS · postgres.js
(raw SQL, no ORM) on PostgreSQL 16 + PostGIS · MiniSearch (client-side search) · MapLibre GL JS
(client-only, host-agnostic style) · Auth.js v5 · zod. Deployed on **DigitalOcean BLR1** behind
Cloudflare, with **Stadia Maps** tiles and **DO Spaces** object storage. Full rationale in
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — stack, the three-store data separation, the
  dual-source read pattern, request flow, and a system diagram.
- [docs/RUNBOOK.md](docs/RUNBOOK.md) — data-refresh cadences, incident response, and the
  BPCL-feed failover.
- [docs/DEPLOY.md](docs/DEPLOY.md) — DigitalOcean BLR1 deploy, env vars, secrets, Spaces, cost.
- [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) — dev workflow, conventions, and the module map.
- [docs/DATA-PROVENANCE.md](docs/DATA-PROVENANCE.md) — the provenance / licensing requirement.

## License & attribution

Map data © OpenStreetMap contributors (ODbL). Government statistics under GODL-India. The
proprietary premium-outlet register is OctaneFinder's own data. See the in-app
[/attribution](src/app/attribution/page.tsx) page and [docs/DATA-PROVENANCE.md](docs/DATA-PROVENANCE.md).
