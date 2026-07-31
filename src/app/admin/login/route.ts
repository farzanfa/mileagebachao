// POST /admin/login — admin-token login for the moderation console.
// Success: sets the httpOnly admin cookie and redirects to /admin.
// Failure: redirects back with ?error=1 (no oracle detail). Rate-limited.

import { NextResponse } from "next/server";

import { ADMIN_COOKIE, adminCookieValue, adminTokenConfigured, verifyAdminToken } from "@/lib/adminToken";
import { rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOGIN_MAX = 10;
const LOGIN_WINDOW_MS = 15 * 60_000;

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  const first = fwd?.split(",")[0]?.trim();
  return first || req.headers.get("x-real-ip")?.trim() || "unknown";
}

export async function POST(req: Request): Promise<Response> {
  const base = new URL(req.url).origin;
  if (!adminTokenConfigured()) {
    return NextResponse.redirect(`${base}/admin?error=notoken`, 303);
  }
  const rl = rateLimit(`admin-login:${clientIp(req)}`, LOGIN_MAX, LOGIN_WINDOW_MS);
  if (!rl.ok) {
    return NextResponse.redirect(`${base}/admin?error=rate`, 303);
  }

  let submitted = "";
  try {
    const form = await req.formData();
    submitted = String(form.get("token") ?? "");
  } catch {
    /* fall through to failure redirect */
  }

  if (!verifyAdminToken(submitted)) {
    return NextResponse.redirect(`${base}/admin?error=1`, 303);
  }

  const res = NextResponse.redirect(`${base}/admin`, 303);
  res.cookies.set(ADMIN_COOKIE, adminCookieValue(), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });
  return res;
}
