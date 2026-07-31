// HTTP helpers, response envelope, session + paging utilities (BUILD-CONTRACT §6/§7).
//
// This module is imported by every route handler under src/app/api/v1/*. It is
// deliberately free of import-time side effects and never requires a database or
// any secret to load (contract §2) — auth is loaded lazily inside requireSession().

import type { ApiErr, ApiMeta, ApiOk } from "@/lib/types";
import { adminEmails, hasAuth } from "@/lib/env";
import { PAGE_LIMIT_DEFAULT, PAGE_LIMIT_MAX, PAGE_OFFSET_MAX } from "@/lib/constants";

const JSON_HEADERS: Readonly<Record<string, string>> = {
  "content-type": "application/json; charset=utf-8",
};

/** Serialize a body to a JSON Response with the given status and optional extra headers. */
function jsonResponse(body: unknown, status: number, extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: extraHeaders ? { ...JSON_HEADERS, ...extraHeaders } : JSON_HEADERS,
  });
}

/**
 * Opaque, prefixed request id used as the support handle on error responses and
 * in structured logs. Format: `req_` + 32 hex chars (no external ULID dep).
 */
export function requestId(): string {
  // crypto.randomUUID is available in the Node.js runtime (contract: runtime="nodejs").
  const uuid =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
  return `req_${uuid.replace(/-/g, "")}`;
}

/**
 * 200 success envelope. `meta` is attached only when provided (list endpoints);
 * detail/scalar responses omit it, per the §5 `ApiOk` shape.
 */
export function ok<T>(data: T, meta?: ApiMeta): Response {
  const body: ApiOk<T> = meta === undefined ? { data } : { data, meta };
  return jsonResponse(body, 200);
}

/**
 * Error envelope (`{ error: { code, message, details? }, requestId }`) with an
 * explicit HTTP status. `details` is omitted when undefined so the payload stays
 * minimal for the common case.
 */
export function err(code: string, message: string, status: number, details?: unknown): Response {
  const body: ApiErr = {
    error: details === undefined ? { code, message } : { code, message, details },
    requestId: requestId(),
  };
  return jsonResponse(body, status);
}

/**
 * Thrown by write-query layers (checkins/corrections/admin) when DATABASE_URL is
 * unset. Route handlers catch it and map to `503 db_unavailable` (contract §7).
 */
export class DbUnavailableError extends Error {
  constructor(message = "Database is not configured; writes are unavailable.") {
    super(message);
    this.name = "DbUnavailableError";
  }
}

/**
 * Parse `limit`/`offset` query params with contract defaults and hard caps.
 * Invalid, missing, or out-of-range values fall back to safe defaults rather than
 * erroring, so list endpoints never 400 on paging alone.
 */
export function parsePaging(url: URL): { limit: number; offset: number } {
  const rawLimit = Number(url.searchParams.get("limit"));
  const rawOffset = Number(url.searchParams.get("offset"));

  const limit =
    Number.isFinite(rawLimit) && rawLimit >= 1
      ? Math.min(Math.floor(rawLimit), PAGE_LIMIT_MAX)
      : PAGE_LIMIT_DEFAULT;

  const offset =
    Number.isFinite(rawOffset) && rawOffset >= 1
      ? Math.min(Math.floor(rawOffset), PAGE_OFFSET_MAX)
      : 0;

  return { limit, offset };
}

// Narrow, defensive view of the Auth.js v5 session — we only read the email.
interface MinimalSession {
  user?: { email?: string | null } | null;
}
type AuthResolver = () => Promise<MinimalSession | null>;

/**
 * Resolve the current authenticated session, or null when unauthenticated /
 * auth is not configured. Returns the caller's email plus whether they are on
 * the admin allow-list (ADMIN_EMAILS).
 *
 * Auth.js (`@/lib/auth`, owned by AUTHMOD) is imported lazily and accessed
 * defensively so that public read routes — which also import this module for
 * ok()/err()/parsePaging() — never pull the auth config into their graph and
 * never break the no-secrets build (contract §2). The `req` argument is accepted
 * for signature stability; Auth.js reads request context from `next/headers`.
 */
export async function requireSession(
  req: Request,
): Promise<{ email: string; isAdmin: boolean } | null> {
  void req;
  if (!hasAuth()) return null;
  try {
    const mod: unknown = await import("@/lib/auth");
    const auth = (mod as { auth?: AuthResolver }).auth;
    if (typeof auth !== "function") return null;
    const session = await auth();
    const email = session?.user?.email;
    if (!email) return null;
    const isAdmin = adminEmails().includes(email.toLowerCase());
    return { email, isAdmin };
  } catch {
    return null;
  }
}
