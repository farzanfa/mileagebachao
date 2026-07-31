# Contributing to OctaneFinder

## Dev setup

```bash
npm ci
cp .env.example .env.local   # optional — the app runs with no config off the seed data
npm run dev                  # http://localhost:3000
```

With a database:

```bash
docker compose up -d db      # postgis:16-3.4 on :5432
npm run migrate && npm run seed
DATABASE_URL=postgres://octane:octane@localhost:5432/octanefinder npm run dev
```

## Checks (run before pushing — CI runs the same)

```bash
npm run typecheck   # tsc --noEmit, strict
npm run lint        # eslint .
npm test            # vitest unit + route-handler tests
npm run build       # next production build (must pass with no DB/secrets)
```

## Architecture ground rules (from BUILD-CONTRACT.md)

- **Reads never require a DB.** The query layer (`src/lib/queries/*`) uses PostgreSQL when
  `DATABASE_URL` is set and falls back to `data/stations.seed.json` otherwise. Writes require a DB
  and return HTTP 503 (`code:"db_unavailable"`) when it is unset. Keep this dual-source contract.
- **No secret may throw at import/build time.** `src/lib/env.ts` validates lazily. `next build`
  must stay green with no environment.
- **Three logically separated data stores** — the proprietary premium-outlet register, the ODbL
  OpenStreetMap geometry layer, and GODL-attributed government stats. **Never row-merge the register
  with the OSM layer** (ODbL share-alike). Every register row carries `source + license +
  retrievedAt + method` in the provenance ledger (see `docs/DATA-PROVENANCE.md`).
- **Prices are shown only when authoritative** (currently only BPCL Speed 100, from the BPCL API).
  Never render single-source secondary prices in the data UI.
- API routes set `runtime="nodejs"` and `dynamic="force-dynamic"`. `maplibre-gl` only in
  `"use client"` components. Import shared types from `@/lib/types`; alias `@/*` → `src/*`.

## Module ownership

The codebase is organized into the slices documented in `BUILD-CONTRACT.md §11`
(foundation, db, api, uicore, mapapp, pages, authmod, legal, pipeline, devops, tests, docs).
When adding a symbol other modules consume, keep its path and signature stable — that contract is
what lets the pieces compose.

## Conventions

- TypeScript strict, `noUncheckedIndexedAccess`; no `any` in exported signatures.
- Prettier for formatting (`.prettierrc`). Keep comments to load-bearing constraints.
- Copy leads with **"ethanol-free (E0)"**, octane supporting. Grades: XP100 / poWer 100 / Speed 100
  are first-class (100 RON, E0); poWer 99 / Speed 97 are labelled **legacy**; 95-RON is out of scope.
- New user-generated-content surfaces need moderation + the grievance path (IT Rules 2021, s.79).
