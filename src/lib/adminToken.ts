// Single-owner admin access via a high-entropy token (env ADMIN_TOKEN), as a
// zero-friction alternative to OAuth for the v1 moderation console. The browser
// never stores the token itself — a successful login sets an HMAC-derived,
// httpOnly cookie; comparisons are constant-time. Google sign-in (ADMIN_EMAILS)
// remains the multi-moderator path and works alongside this.

import { createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_COOKIE = "mb_admin";

function token(): string {
  return process.env.ADMIN_TOKEN ?? "";
}

/** Token auth is enabled only when a sufficiently long secret is configured. */
export function adminTokenConfigured(): boolean {
  return token().length >= 24;
}

function derivedCookieValue(): string {
  return createHmac("sha256", `mileagebachao-admin-v1|${token()}`).update(token()).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Verify a submitted login token against ADMIN_TOKEN. */
export function verifyAdminToken(submitted: string | null | undefined): boolean {
  if (!adminTokenConfigured() || !submitted) return false;
  return safeEqual(submitted.trim(), token());
}

/** Value to store in the admin cookie after a successful login. */
export function adminCookieValue(): string {
  return derivedCookieValue();
}

/** Verify the admin cookie presented on a request. */
export function verifyAdminCookie(value: string | null | undefined): boolean {
  if (!adminTokenConfigured() || !value) return false;
  return safeEqual(value, derivedCookieValue());
}
