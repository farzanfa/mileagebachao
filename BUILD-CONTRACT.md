# OctaneFinder — BUILD CONTRACT (authoritative)

Every builder agent MUST follow this contract exactly: same file paths, same exported names, same
type shapes, same function signatures, same API response envelope, same component props. Do not
invent alternatives. If something is underspecified, prefer the simplest choice consistent with the
rest of this file and note it in a code comment. Full domain detail (DB DDL, API bodies, UX) lives in
the spec section files under the scratchpad — read them when you need depth:

- DB schema detail: `<SCRATCH>/final-database.md`
- API detail: `<SCRATCH>/final-api.md`
- UI/UX + design system: `<SCRATCH>/final-uiux.md`
- Data pipeline: `<SCRATCH>/final-datasources.md`
- Legal/compliance: `<SCRATCH>/final-legal.md`
- Prototype (design tokens, seed data, freshness logic to port): `<SCRATCH>/octanefinder-prototype.html`

`<SCRATCH>` = `/private/tmp/claude-501/-Users-farzanfa-petrolindo/f643afbd-e9d7-4699-a927-383612c6ce63/scratchpad`
Repo root = `/Users/farzanfa/petrolindo`

---

## 0. Product facts that the code and copy must respect (from the binding decision memo)

- Three first-class grades, all **100 RON, ethanol-free (E0)**: `XP100` (IOCL), `poWer 100` (HPCL), `Speed 100` (BPCL).
- Two legacy grades, always labelled legacy: `poWer 99` (HPCL, 99 RON, ethanol unknown), `Speed 97` (BPCL, 97 RON, E20).
- **Price is shown only when authoritative.** Only `Speed 100` has an authoritative price in seed data: **₹169.00/L, source "BPCL locator API", asOf "2026-07-28"**. Every other grade shows no price.
- "Unverified — official listing, not yet field-confirmed" badge on any station whose grades were never field-verified.
- Positioning copy leads with **"ethanol-free (E0)"**, octane supporting.

---

## 1. Stack & pinned versions (use these EXACT ranges in package.json)

```
next@^15.1.0  react@^19.0.0  react-dom@^19.0.0  typescript@^5.7.2
tailwindcss@^3.4.17  postcss@^8.4.49  autoprefixer@^10.4.20
postgres@^3.4.5            (postgres.js — the DB driver; NO Prisma)
zod@^3.24.1
minisearch@^7.1.1
maplibre-gl@^4.7.1
next-auth@5.0.0-beta.25    (Auth.js v5, App Router)
tsx@^4.19.2                (run TS scripts: migrate, seed)
```
devDeps:
```
@types/node@^22  @types/react@^19  @types/react-dom@^19
eslint@^8.57.1  eslint-config-next@^15.1.0  prettier@^3.4.2
vitest@^2.1.8  @vitejs/plugin-react@^4.3.4
@playwright/test@^1.49.1
```
- Package manager: **npm** (commit `package-lock.json`). `"engines": { "node": ">=20" }`.
- `"type": "module"` in package.json. Config files use `.mjs`/`.ts` accordingly.
- Scripts in package.json: `dev`, `build`, `start`, `lint`, `typecheck` (`tsc --noEmit`), `test` (`vitest run`), `test:e2e` (`playwright test`), `migrate` (`tsx scripts/migrate.ts`), `seed` (`tsx scripts/seed.ts`), `build:index` (`tsx scripts/build-search-index.ts`).

## 2. Hard build rules (so `npm run build` passes with NO database and NO secrets)

1. **Reads never require a live DB.** The read query layer falls back to the committed seed dataset
   (`data/stations.seed.json`) when `DATABASE_URL` is unset. So `next build`, SSG, and the whole
   read-only v1.0 app run with zero infra. The DB is the source of truth for **writes** (check-ins,
   corrections, moderation) and for production-scale reads.
2. **No secret is required at build/import time.** `src/lib/env.ts` validates lazily; missing optional
   secrets must not throw during `next build`. Write routes that need the DB return HTTP 503 with the
   standard error envelope (`code: "db_unavailable"`) when `DATABASE_URL` is unset.
3. Every API route file sets `export const runtime = "nodejs"` and `export const dynamic = "force-dynamic"`.
4. `generateStaticParams` reads the seed dataset via `src/lib/data.ts` — never the DB.
5. Client-only libraries (`maplibre-gl`) live in components marked `"use client"`; never imported into
   server components or route handlers.
6. Path alias `@/*` → `src/*` (set in tsconfig `paths`). TypeScript `strict: true`, `noUncheckedIndexedAccess: true`.
7. No `any` in exported signatures. No unused exports that break `next lint`.

## 3. File tree (create exactly these paths; each builder owns a disjoint slice — see §11)

```
package.json  tsconfig.json  next.config.mjs  tailwind.config.ts  postcss.config.mjs
eslint.config.mjs  .prettierrc  .gitignore  .env.example  README.md
docker-compose.yml  Dockerfile  .dockerignore  vitest.config.ts  playwright.config.ts
.do/app.yaml  .github/workflows/ci.yml
data/  brands.json  grades.json  origins.json  stations.seed.json
migrations/  0001_init.sql  0002_indexes.sql  0003_seed_reference.sql
scripts/  migrate.ts  seed.ts  build-search-index.ts
src/
  app/
    layout.tsx  globals.css  page.tsx            (landing)
    map/page.tsx                                  (interactive app view)
    [city]/page.tsx                               (city SEO page)
    station/[id]/page.tsx                         (station detail SEO page)
    legal/page.tsx  privacy/page.tsx  terms/page.tsx  attribution/page.tsx  about/page.tsx
    sitemap.ts  robots.ts
    api/v1/
      health/route.ts
      stations/route.ts                           (search/list)
      stations/nearby/route.ts
      stations/[id]/route.ts
      corrections/route.ts
      images/route.ts                             (presigned upload)
      checkins/route.ts
      admin/queue/route.ts
      admin/queue/[id]/route.ts
    admin/page.tsx                                (moderation UI, v1.1)
  lib/
    types.ts  env.ts  db.ts  data.ts  geo.ts  freshness.ts  search.ts
    api.ts  validation.ts  ratelimit.ts  auth.ts  constants.ts
    queries/  stations.ts  nearby.ts  checkins.ts  corrections.ts  admin.ts  provenance.ts
  components/
    Header.tsx  ThemeToggle.tsx  Filters.tsx  StationList.tsx  StationCard.tsx
    StationDetail.tsx  FreshnessBadge.tsx  GradeTag.tsx  BrandChip.tsx
    map/MapLibreMap.tsx  ui/Button.tsx  ui/Switch.tsx  ui/Chip.tsx
    AppShell.tsx                                   (client: wires Filters+Map+List+Detail)
  styles/tokens.css
pipeline/  requirements.txt  common.py  poll_bpcl.py  diff_hpcl.py  crawl_iocl_sitemap.py
           normalize.py  load.py  README.md
tests/  freshness.test.ts  geo.test.ts  validation.test.ts  api-stations.test.ts
e2e/  smoke.spec.ts
docs/  ARCHITECTURE.md  RUNBOOK.md  DEPLOY.md  DATA-PROVENANCE.md  CONTRIBUTING.md
```

## 4. Environment variables (`.env.example` + `src/lib/env.ts`)

```
# Runtime (all optional for build; features degrade if unset)
DATABASE_URL=postgres://octane:octane@localhost:5432/octanefinder   # unset => read from seed JSON, writes 503
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_MAP_STYLE_URL=                     # Stadia/MapTiler style URL; empty => map shows "configure map" state
NEXT_PUBLIC_MAP_ATTRIBUTION=© OpenStreetMap contributors
AUTH_SECRET=                                   # next-auth; required only when auth used
AUTH_GOOGLE_ID=      AUTH_GOOGLE_SECRET=
EMAIL_SERVER=        EMAIL_FROM=
S3_ENDPOINT=  S3_REGION=  S3_BUCKET=  S3_ACCESS_KEY_ID=  S3_SECRET_ACCESS_KEY=   # DO Spaces (presign)
ADMIN_EMAILS=                                  # comma-separated emails granted admin role
RATE_LIMIT_MAX=60  RATE_LIMIT_WINDOW_MS=60000
```
`src/lib/env.ts` exports `env` (validated, server) and `publicEnv` (NEXT_PUBLIC_* only). Use zod
`.optional()` generously; export `hasDb(): boolean`, `hasAuth(): boolean`, `hasS3(): boolean`.

## 5. Shared types — `src/lib/types.ts` (EXACT exports; everyone imports from `@/lib/types`)

```ts
export type Brand = "IOCL" | "HPCL" | "BPCL";
export type GradeName = "XP100" | "poWer 100" | "Speed 100" | "poWer 99" | "Speed 97";
export type Availability = "in_stock" | "out_of_stock" | "unknown";
export type VerificationStatus = "official-listed" | "field-verified" | "stale";
export type FreshnessKey = "fresh" | "likely" | "stale" | "dry" | "unverified";
export type SortKey = "dist" | "fresh";

export interface GradeMeta { name: GradeName; brand: Brand; ron: number; e0: boolean | null; legacy: boolean; full: string; }
export interface BrandMeta { id: Brand; name: string; colorVar: string; } // colorVar e.g. "--brand-iocl"
export interface OriginCity { id: string; name: string; lat: number; lng: number; }

export interface ProvenanceRef { source: string; license: string; retrievedAt: string; method: string; }
export interface StationGrade {
  grade: GradeName;
  availability: Availability;
  lastVerifiedDays: number | null; // null => never field-verified
  checkins: number;
  status: VerificationStatus;
}
export interface Price { grade: GradeName; value: string; currency: "INR"; source: string; asOf: string; }

export interface Station {
  id: string;            // stable id, e.g. "iocl-dl-0421"
  slug: string;          // url slug, e.g. "connaught-place-indianoil"
  name: string;
  brand: Brand;
  city: string;
  citySlug: string;      // e.g. "delhi"
  state: string;
  pincode: string;
  lat: number;
  lng: number;
  roCode: string;
  address: string;
  phone: string | null;
  grades: StationGrade[];
  price: Price | null;
  sources: ProvenanceRef[];
  firstSeen: string;     // ISO date
  lastVerified: string | null; // ISO date; moved ONLY by a check-in
}
export interface StationWithDistance extends Station { distanceKm: number; }

export interface Coord { lat: number; lng: number; }
export interface Bounds { minLat: number; minLng: number; maxLat: number; maxLng: number; }

export interface FilterState {
  grades: Record<GradeName, boolean>;
  brands: Record<Brand, boolean>;
  e0Only: boolean;
  query: string;
  originId: string;
  sort: SortKey;
}

// API envelope
export interface ApiMeta { total: number; limit: number; offset: number; hasMore: boolean; }
export interface ApiOk<T> { data: T; meta?: ApiMeta; }
export interface ApiErr { error: { code: string; message: string; details?: unknown }; requestId: string; }

// write payloads
export interface CorrectionInput { stationId: string; field: string; value: string; note?: string; contact?: string; }
export interface CheckinInput { stationId: string; grade: GradeName; result: "in_stock" | "out_of_stock" | "not_stocked"; lat?: number; lng?: number; }
```

## 6. Lib module contracts (exact signatures)

`src/lib/geo.ts`
```ts
export function haversineKm(a: Coord, b: Coord): number;
export function toSlug(input: string): string;
```
`src/lib/freshness.ts` (port logic from the prototype)
```ts
export interface FreshnessInfo { key: FreshnessKey; label: string; colorVar: string; } // colorVar e.g. "--fresh"
export function gradeFreshness(g: StationGrade): FreshnessInfo;
export function reliabilityScore(g: StationGrade): number; // 0..100
export function stationIsAllUnverified(s: Station): boolean;
export function relDays(days: number | null): string;
export function bestFreshness(s: Station, visibleGrades?: GradeName[]): FreshnessInfo;
```
`src/lib/data.ts` (build-time & fallback source; reads committed JSON)
```ts
export function allStations(): Station[];
export function gradeMeta(): Record<GradeName, GradeMeta>;
export function brandMeta(): Record<Brand, BrandMeta>;
export function origins(): OriginCity[];
export function stationById(id: string): Station | undefined;
export function cities(): { slug: string; name: string; state: string; count: number }[];
```
`src/lib/db.ts`
```ts
import postgres from "postgres";
export function getDb(): ReturnType<typeof postgres> | null; // null when DATABASE_URL unset (lazy singleton)
export function hasDb(): boolean;
```
`src/lib/queries/stations.ts` — DB when available, else `data.ts`:
```ts
export interface StationFilter { grades?: GradeName[]; brands?: Brand[]; e0Only?: boolean; query?: string; }
export async function listStations(f: StationFilter, limit: number, offset: number): Promise<{ rows: Station[]; total: number }>;
export async function getStation(id: string): Promise<Station | null>;
```
`src/lib/queries/nearby.ts`
```ts
export async function nearbyStations(c: Coord, radiusKm: number, f: StationFilter, limit: number): Promise<StationWithDistance[]>;
```
`src/lib/queries/checkins.ts` / `corrections.ts` / `admin.ts` — write ops; require DB, else throw `DbUnavailableError`.
`src/lib/queries/provenance.ts` — provenance ledger read/write.
`src/lib/api.ts`
```ts
export function ok<T>(data: T, meta?: ApiMeta): Response;                 // 200 JSON ApiOk
export function err(code: string, message: string, status: number, details?: unknown): Response; // ApiErr
export function requestId(): string;
export async function requireSession(req: Request): Promise<{ email: string; isAdmin: boolean } | null>;
export function parsePaging(url: URL): { limit: number; offset: number };
export class DbUnavailableError extends Error {}
```
`src/lib/ratelimit.ts`
```ts
export function rateLimit(key: string, max?: number, windowMs?: number): { ok: boolean; remaining: number; resetMs: number };
```
`src/lib/validation.ts` — one zod schema per endpoint, exported:
`stationsQuerySchema, nearbyQuerySchema, correctionSchema, checkinSchema, imagePresignSchema, adminDecisionSchema`.
`src/lib/search.ts`
```ts
import MiniSearch from "minisearch";
export function buildIndex(stations: Station[]): MiniSearch;      // fields: name, city, state, pincode, address
export const searchFields: string[];
export const storeFields: string[];
```

## 7. API endpoints (all under `/api/v1`, all return the §5 envelope)

- `GET /health` → `{ data: { status: "ok", db: boolean, ts: string } }`
- `GET /stations?q&grade=&brand=&e0Only=&limit=&offset=&sort=` → `ApiOk<Station[]>` + `meta`
- `GET /stations/nearby?lat&lng&radiusKm&grade=&brand=&e0Only=&limit=` → `ApiOk<StationWithDistance[]>`
- `GET /stations/:id` → `ApiOk<Station>` | 404 `code:"not_found"`
- `POST /corrections` (anonymous allowed; rate-limited) body=`CorrectionInput` → 202 `ApiOk<{id:string}>`
- `POST /images` body=`{ stationId, contentType }` → `ApiOk<{ uploadUrl, publicUrl, key }>` (503 `code:"s3_unavailable"` if no S3)
- `POST /checkins` (**auth required**, 401 `code:"unauthorized"`; geofence check) body=`CheckinInput` → 201 `ApiOk<{id, newLastVerified}>`
- `GET /admin/queue?type=&status=` (**admin only**, 403 `code:"forbidden"`) → `ApiOk<QueueItem[]>`
- `POST /admin/queue/:id` (**admin**) body=`{ decision:"approve"|"reject", note? }` → `ApiOk<{id, status}>`
Unknown query params ignored. Validation failure → 400 `code:"invalid_request"` with zod issues in `details`.
When `DATABASE_URL` unset: reads still work (seed fallback); writes → 503 `code:"db_unavailable"`.

## 8. Component props (exact; import types from `@/lib/types`)

```ts
BrandChip({ brand, withLabel = true, className }: { brand: Brand; withLabel?: boolean; className?: string })
GradeTag({ grade, freshness }: { grade: GradeName; freshness?: FreshnessKey })
FreshnessBadge({ grade }: { grade: StationGrade })
ThemeToggle()  // no props
Filters({ value, onChange, gradeMeta, brandMeta, origins }: { value: FilterState; onChange: (f: FilterState) => void; gradeMeta: Record<GradeName,GradeMeta>; brandMeta: Record<Brand,BrandMeta>; origins: OriginCity[] })
StationCard({ station, distanceKm, selected, onSelect }: { station: Station; distanceKm?: number; selected?: boolean; onSelect?: (id: string) => void })
StationList({ stations, selectedId, onSelect }: { stations: (Station | StationWithDistance)[]; selectedId?: string | null; onSelect?: (id: string) => void })
StationDetail({ station, onClose }: { station: Station; onClose?: () => void })
MapLibreMap({ stations, selectedId, onSelectStation, styleUrl }: { stations: Station[]; selectedId?: string | null; onSelectStation?: (id: string) => void; styleUrl?: string })  // "use client"
AppShell({ initialStations, gradeMeta, brandMeta, origins }: {...})  // "use client"; owns FilterState, wires everything, computes distance via geo.haversineKm
Header({ }) ; ui/Button, ui/Switch, ui/Chip generic.
```
Server pages (`app/**/page.tsx`) fetch via the query layer directly (never self-fetch HTTP) and pass
plain data into client components. `app/map/page.tsx` renders `<AppShell>` with `allStations()`.

## 9. Design system (port from prototype `<style>` block; put tokens in `src/styles/tokens.css`, imported by `globals.css`)

CSS custom properties, light + dark, with `@media (prefers-color-scheme: dark)` AND
`:root[data-theme="dark"|"light"]` overrides. Token names (reuse verbatim):
`--bg --surface --surface-2 --ink --ink-2 --ink-3 --line --line-strong --accent --accent-ink
--accent-soft --fresh --stale --dry --unknown --brand-iocl --brand-hpcl --brand-bpcl`.
Tailwind: extend theme `colors` to reference these via `rgb(var(--x))`? No — keep it simple: expose
tokens as CSS vars and use Tailwind utilities for layout/spacing/type; use `style={{color:"var(--ink)"}}`
or small utility classes for token colors. Fonts: system stacks only (CSP blocks webfonts) — sans
`-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, Roboto, sans-serif`; mono `ui-monospace, "SF Mono", Menlo, Consolas, monospace`.
WCAG 2.2 AA: visible focus rings, 44px touch targets, `prefers-reduced-motion`, labelled controls.
ThemeToggle stamps `document.documentElement.dataset.theme`.

## 10. Data (`data/*.json`) — produced by the Foundation builder from the prototype seed

- `stations.seed.json`: `Station[]` — expand the prototype's 24 seed stations into the full `Station`
  shape (add `id`, `slug`, `citySlug`, `state`, `pincode`, `sources[]`, `firstSeen`, `lastVerified`,
  map `availability` "in"→"in_stock" etc, derive `status` from lastVerifiedDays: null→"official-listed",
  ≤30→"field-verified", >30→"stale"). Keep Speed 100 price ₹169.00 only. Aim for ≥24 stations.
- `grades.json`: `GradeMeta[]`; `brands.json`: `BrandMeta[]` (colorVar "--brand-iocl" etc);
  `origins.json`: `OriginCity[]` (the 6 origin cities from the prototype).

## 11. Ownership map (which builder writes which files — DISJOINT, no overlaps)

- **FOUNDATION** (runs first, alone): package.json, tsconfig.json, next.config.mjs, tailwind.config.ts,
  postcss.config.mjs, eslint.config.mjs, .prettierrc, .gitignore, .env.example, .dockerignore,
  src/app/layout.tsx, src/app/globals.css, src/styles/tokens.css, src/lib/types.ts, src/lib/env.ts,
  src/lib/constants.ts, src/lib/geo.ts, src/lib/freshness.ts, src/lib/data.ts, src/lib/db.ts,
  data/grades.json, data/brands.json, data/origins.json, data/stations.seed.json.
- **DB**: migrations/*.sql, scripts/migrate.ts, scripts/seed.ts, src/lib/queries/stations.ts,
  src/lib/queries/nearby.ts, src/lib/queries/provenance.ts.
- **API**: src/lib/api.ts, src/lib/validation.ts, src/lib/ratelimit.ts, src/app/api/v1/health/route.ts,
  stations/route.ts, stations/nearby/route.ts, stations/[id]/route.ts, corrections/route.ts, images/route.ts.
- **UICORE**: src/components/ThemeToggle.tsx, Header.tsx, BrandChip.tsx, GradeTag.tsx,
  FreshnessBadge.tsx, ui/Button.tsx, ui/Switch.tsx, ui/Chip.tsx, Filters.tsx, StationCard.tsx,
  StationList.tsx, src/lib/search.ts, scripts/build-search-index.ts.
- **MAPAPP**: src/components/map/MapLibreMap.tsx, src/components/StationDetail.tsx,
  src/components/AppShell.tsx, src/app/map/page.tsx.
- **PAGES**: src/app/page.tsx (landing), src/app/[city]/page.tsx, src/app/station/[id]/page.tsx,
  src/app/sitemap.ts, src/app/robots.ts, src/app/about/page.tsx.
- **AUTHMOD**: src/lib/auth.ts, src/app/api/v1/checkins/route.ts, src/app/api/v1/admin/queue/route.ts,
  src/app/api/v1/admin/queue/[id]/route.ts, src/app/admin/page.tsx, src/lib/queries/checkins.ts,
  src/lib/queries/corrections.ts, src/lib/queries/admin.ts.
- **LEGAL**: src/app/legal/page.tsx, privacy/page.tsx, terms/page.tsx, attribution/page.tsx,
  docs/DATA-PROVENANCE.md.
- **PIPELINE**: pipeline/* (Python).
- **DEVOPS**: Dockerfile, docker-compose.yml, .do/app.yaml, .github/workflows/ci.yml.
- **TESTS**: vitest.config.ts, playwright.config.ts, tests/*, e2e/*.
- **DOCS**: README.md, docs/ARCHITECTURE.md, RUNBOOK.md, DEPLOY.md, CONTRIBUTING.md.

If you need a symbol another builder owns, import it from the path in this contract — it WILL exist.
Do not create files outside your slice. Do not edit another builder's files.
