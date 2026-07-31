// Shared admin authorization for the /admin dashboard (pages + server actions).
// Admin = allow-listed session email (Google, ADMIN_EMAILS) OR a valid admin-token cookie.

import { cookies } from "next/headers";

import { ADMIN_COOKIE, verifyAdminCookie } from "@/lib/adminToken";
import { auth, isAdminEmail } from "@/lib/auth";

export async function isAuthorized(): Promise<{ ok: boolean; who: string | null }> {
  const session = await auth();
  const email = session?.user?.email ?? null;
  if (isAdminEmail(email)) return { ok: true, who: email };
  const jar = await cookies();
  if (verifyAdminCookie(jar.get(ADMIN_COOKIE)?.value)) return { ok: true, who: "admin (token)" };
  return { ok: false, who: null };
}
