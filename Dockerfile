# syntax=docker/dockerfile:1
#
# OctaneFinder — production container (BUILD-CONTRACT §2, §11 DEVOPS slice).
#
# Multi-stage build producing a lean, non-root Next.js **standalone** runtime.
#   base     → common Alpine + Node 20 layer
#   deps     → full dependency install (incl. devDeps; needed to build)
#   builder  → `next build` → .next/standalone
#   runner   → FINAL: minimal standalone server, non-root, HEALTHCHECK  (web service)
#   migrator → full-tooling one-shot that runs `npm run migrate && npm run seed`
#
# The read layer falls back to committed seed JSON, so this image builds and runs
# with NO database and NO secrets (BUILD-CONTRACT §2). Write routes return 503 until
# DATABASE_URL is supplied.
#
# NOTE (cross-slice dependency): the runner stage requires `next.config.mjs` to set
#   const nextConfig = { output: "standalone", ... }
# That file is owned by FOUNDATION (BUILD-CONTRACT §11); this slice assumes it is set.
# The builder stage below hard-fails with a clear message if the standalone output
# is missing, so a misconfiguration surfaces immediately rather than at COPY time.

ARG NODE_VERSION=20

########################################
# base — shared foundation
########################################
FROM node:${NODE_VERSION}-alpine AS base
# libc6-compat: some Node native addons expect glibc symbols under musl/Alpine.
RUN apk add --no-cache libc6-compat
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

########################################
# deps — install ALL dependencies (dev included; tsx/tailwind/tsc needed to build)
# NODE_ENV is intentionally NOT "production" here, or npm would prune devDependencies.
########################################
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

########################################
# builder — compile the app to standalone output
########################################
FROM base AS builder
ENV NODE_ENV=production

# NEXT_PUBLIC_* are inlined into the client bundle at build time, so they must be
# present as build args (not just runtime env). Callers pass them via
# docker build --build-arg / compose build.args / DO BUILD_TIME-scoped envs.
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ARG NEXT_PUBLIC_MAP_STYLE_URL=
ARG NEXT_PUBLIC_MAP_ATTRIBUTION="© OpenStreetMap contributors"
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL} \
    NEXT_PUBLIC_MAP_STYLE_URL=${NEXT_PUBLIC_MAP_STYLE_URL} \
    NEXT_PUBLIC_MAP_ATTRIBUTION=${NEXT_PUBLIC_MAP_ATTRIBUTION}

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# next.config.mjs has `eslint.ignoreDuringBuilds` set; lint runs as a separate CI step.
# Build reads seed JSON only — no DATABASE_URL / secrets required.
RUN npm run build \
 && test -d .next/standalone || { \
      echo "ERROR: .next/standalone was not produced." >&2; \
      echo "next.config.mjs must set output: \"standalone\" (BUILD-CONTRACT §11, owned by FOUNDATION)." >&2; \
      exit 1; \
    }

########################################
# migrator — one-shot: apply SQL migrations + seed the database.
# Has the full toolchain (tsx, source, migrations/, scripts/, data/) that the tsx
# scripts require. Used by docker-compose and can be targeted with `--target migrator`.
# Requires DATABASE_URL at run time; safe to re-run (migrations/seed are idempotent).
########################################
FROM builder AS migrator
ENV NODE_ENV=production
CMD ["sh", "-c", "npm run migrate && npm run seed"]

########################################
# runner — FINAL minimal production image (web service)
########################################
FROM base AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Dedicated non-root user (canonical Next.js pattern).
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Standalone server + its traced (pruned) node_modules.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# Static assets are NOT included in standalone — copy them into place.
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Committed reference/seed dataset — the no-DB read fallback (BUILD-CONTRACT §2, §10).
# Statically imported at build (so already bundled) but copied for defensive fs reads.
COPY --from=builder --chown=nextjs:nodejs /app/data ./data

USER nextjs
EXPOSE 3000

# Liveness/readiness probe against the health route (BUILD-CONTRACT §7).
# Node 20 ships a global fetch; honour PORT so it tracks the runtime binding.
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Next.js standalone entrypoint.
CMD ["node", "server.js"]
