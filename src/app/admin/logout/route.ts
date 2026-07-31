// POST /admin/logout — clear the admin-token cookie.

import { NextResponse } from "next/server";

import { ADMIN_COOKIE } from "@/lib/adminToken";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  const res = NextResponse.redirect(`${new URL(req.url).origin}/admin`, 303);
  res.cookies.set(ADMIN_COOKIE, "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
  return res;
}
