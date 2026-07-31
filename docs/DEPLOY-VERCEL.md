# Deploying MileageBachao to Vercel — mileagebachao.in

The app is a standard Next.js 15 App Router project, so Vercel builds and serves it natively —
route handlers become serverless functions, the city/station pages are prerendered (SSG/ISR), and
the read-only site works with **no database** (it falls back to `data/stations.seed.json`). Region is
pinned to **`bom1` (Mumbai)** in `vercel.json` for India latency and data-residency intent.

## 1. First deploy (zero backend)

```bash
npm i -g vercel
vercel            # link the project, accept defaults
vercel --prod
```

## 1a. Attach the domain (mileagebachao.in)

```bash
vercel domains add mileagebachao.in
vercel domains add www.mileagebachao.in   # Vercel auto-redirects www -> apex
```

Then at your registrar's DNS panel set:

| Record | Host | Value |
| --- | --- | --- |
| `A` | `@` (apex) | `76.76.21.21` |
| `CNAME` | `www` | `cname.vercel-dns.com` |

(If the registrar supports it, switching nameservers to Vercel — `ns1.vercel-dns.com` /
`ns2.vercel-dns.com` — is even simpler and lets Vercel manage everything.) TLS certificates are
issued automatically once DNS propagates (usually minutes, up to ~48h). Verify with
`vercel domains inspect mileagebachao.in`.

**Then set `NEXT_PUBLIC_SITE_URL=https://mileagebachao.in`** in the Vercel project's env vars and
redeploy — this drives canonical URLs, the sitemap, robots.txt, and OpenGraph URLs. The grievance /
privacy / legal contact addresses in the app are `grievance@ / privacy@ / legal@mileagebachao.in`
— create these mailboxes (or aliases) at your mail provider; the IT Rules grievance address must
actually receive mail before UGC goes live.

Set at minimum:

| Env var | Value |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | your production URL (e.g. `https://mileagebachao.in`) |
| `NEXT_PUBLIC_MAP_STYLE_URL` | a Stadia/MapTiler style URL (leave empty to show the "configure map" panel) |

That alone gives you the full read-only product: search, filters, map, city/station SEO pages,
station detail, and the read API — all off the committed dataset.

## 2. Add a database (for check-ins, corrections, moderation, scale)

Vercel does not host Postgres; use a **serverless Postgres with PostGIS**:

- **Neon** (recommended) — has PostGIS; use the **pooled** connection string (`...-pooler...`).
- **Supabase** — has PostGIS; use the transaction-pooler string (port 6543).
- **Vercel Postgres** (Neon under the hood).

The DB client (`src/lib/db.ts`) auto-detects serverless/pooled connections: on Vercel it uses
`max: 1` and disables prepared statements (required for pgbouncer transaction pooling). Override with
`DB_POOL_MAX` / `DB_PREPARE` if needed.

```bash
# one-time, from your machine, against the Neon/Supabase DIRECT (non-pooled) URL:
DATABASE_URL="postgres://…direct…" npm run migrate
DATABASE_URL="postgres://…direct…" npm run seed
```

Then set the **pooled** URL in Vercel:

| Env var | Notes |
| --- | --- |
| `DATABASE_URL` | pooled connection string |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google OAuth (v1.1 accounts) |
| `EMAIL_SERVER` / `EMAIL_FROM` | magic-link sign-in (v1.1) |
| `ADMIN_EMAILS` | comma-separated moderator emails |

> Enable PostGIS once on the database: `CREATE EXTENSION IF NOT EXISTS postgis;`

## 3. Photo uploads (v1.1)

Presigned uploads (`/api/v1/images`) target S3-compatible storage. On Vercel, use **Cloudflare R2**
or **AWS S3** (or **Vercel Blob** with a small adapter). Set `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`,
`S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`. Without them the route returns 503 (feature simply off).

## 4. Map tiles

MapLibre needs a style URL. Stadia Maps Starter (~$20/mo) or MapTiler free tier both work — set
`NEXT_PUBLIC_MAP_STYLE_URL`. Attribution ("© OpenStreetMap contributors") is already wired.

## 5. Notes vs. the DigitalOcean path

`Dockerfile`, `docker-compose.yml`, and `.do/app.yaml` remain for a self-hosted/DO deployment and
are unused on Vercel. Vercel is now the primary target; keep both only if you want the option.

## Cost on Vercel

- **Hobby**: $0 for the read-only site (static pages + light function traffic).
- **Pro** (~$20/mo) once you have real traffic + a database. Serverless Postgres (Neon free →
  ~$19/mo), map tiles (~$20/mo), object storage (a few $). Roughly in line with the spec's ~$65/mo
  launch envelope. Client-side search means query volume is never a function-invocation cost.
