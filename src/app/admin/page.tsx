// Moderation console (AUTHMOD slice; BUILD-CONTRACT §7, §11 — v1.1 admin UI).
//
// Server component: gates on an admin session (ADMIN_EMAILS), reads the queue via listQueue,
// and posts approve/reject decisions through a Server Action -> decideQueue. Force-dynamic so it
// is never prerendered at build (no auth()/DB calls at build; contract §2). Degrades gracefully
// when auth or the database is unconfigured.

import type { ReactNode } from "react";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { DbUnavailableError } from "@/lib/api";
import { ADMIN_COOKIE, adminTokenConfigured, verifyAdminCookie } from "@/lib/adminToken";
import { auth, isAdminEmail } from "@/lib/auth";
import { decideQueue, listQueue, type QueueItem } from "@/lib/queries/admin";

/** Admin = allow-listed session email OR a valid admin-token cookie. */
async function isAuthorized(): Promise<{ ok: boolean; who: string | null }> {
  const session = await auth();
  const email = session?.user?.email ?? null;
  if (isAdminEmail(email)) return { ok: true, who: email };
  const jar = await cookies();
  if (verifyAdminCookie(jar.get(ADMIN_COOKIE)?.value)) return { ok: true, who: "admin (token)" };
  return { ok: false, who: null };
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Moderation queue - MileageBachao",
  robots: { index: false, follow: false },
};

const TYPE_LABEL: Record<QueueItem["type"], string> = {
  correction: "Correction",
  checkin: "Check-in",
  new_station: "New station",
};

const STATUS_COLOR: Record<QueueItem["status"], string> = {
  pending: "var(--accent)",
  approved: "var(--fresh)",
  rejected: "var(--dry)",
};

// --- Server Action: decide a queue item ------------------------------------------------------
async function decideAction(formData: FormData): Promise<void> {
  "use server";

  // Defence in depth: re-check admin inside the action, never trust the rendered form alone.
  const { ok } = await isAuthorized();
  if (!ok) return;

  const id = String(formData.get("id") ?? "");
  const decision = String(formData.get("decision") ?? "") === "reject" ? "reject" : "approve";
  const noteRaw = formData.get("note");
  const note = typeof noteRaw === "string" && noteRaw.trim().length > 0 ? noteRaw.trim() : undefined;
  if (!id) return;

  try {
    await decideQueue(id, decision, note);
  } catch (e) {
    if (!(e instanceof DbUnavailableError)) throw e;
    // No database configured => nothing to decide; fall through and re-render.
  }
  revalidatePath("/admin");
}

// --- Presentational helpers ------------------------------------------------------------------
function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div
      style={{
        maxWidth: "48rem",
        margin: "4rem auto",
        padding: "2rem",
        background: "var(--surface)",
        border: "1px solid var(--line)",
        borderRadius: "0.75rem",
        color: "var(--ink)",
      }}
    >
      <h1 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.75rem" }}>{title}</h1>
      <div style={{ color: "var(--ink-2)", lineHeight: 1.6 }}>{children}</div>
    </div>
  );
}

function QueueCard({ item }: { item: QueueItem }) {
  return (
    <li
      style={{
        listStyle: "none",
        background: "var(--surface)",
        border: "1px solid var(--line)",
        borderRadius: "0.75rem",
        padding: "1rem 1.25rem",
        marginBottom: "1rem",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.75rem",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <span
            style={{
              fontSize: "0.75rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              padding: "0.15rem 0.5rem",
              borderRadius: "999px",
              background: "var(--accent-soft)",
              color: "var(--accent-ink)",
            }}
          >
            {TYPE_LABEL[item.type]}
          </span>
          <span
            style={{
              fontSize: "0.75rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              color: STATUS_COLOR[item.status],
            }}
          >
            {item.status}
          </span>
        </div>
        <code style={{ fontSize: "0.75rem", color: "var(--ink-3)" }}>
          {item.stationId ?? "(no station)"} · {new Date(item.createdAt).toLocaleString()}
        </code>
      </div>

      <pre
        style={{
          marginTop: "0.75rem",
          padding: "0.75rem",
          overflowX: "auto",
          fontSize: "0.8125rem",
          lineHeight: 1.5,
          background: "var(--surface-2)",
          border: "1px solid var(--line)",
          borderRadius: "0.5rem",
          color: "var(--ink-2)",
        }}
      >
        {JSON.stringify(item.payload, null, 2)}
      </pre>

      {item.status === "pending" ? (
        <form action={decideAction} style={{ marginTop: "0.75rem" }}>
          <input type="hidden" name="id" value={item.id} />
          <label
            htmlFor={`note-${item.id}`}
            style={{ display: "block", fontSize: "0.75rem", color: "var(--ink-2)", marginBottom: "0.25rem" }}
          >
            Moderator note (optional)
          </label>
          <textarea
            id={`note-${item.id}`}
            name="note"
            rows={2}
            style={{
              width: "100%",
              padding: "0.5rem",
              fontSize: "0.875rem",
              background: "var(--bg)",
              color: "var(--ink)",
              border: "1px solid var(--line-strong)",
              borderRadius: "0.5rem",
              resize: "vertical",
            }}
          />
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
            <button
              type="submit"
              name="decision"
              value="approve"
              style={{
                minHeight: "44px",
                padding: "0 1rem",
                fontWeight: 600,
                cursor: "pointer",
                background: "var(--fresh)",
                color: "#fff",
                border: "none",
                borderRadius: "0.5rem",
              }}
            >
              Approve
            </button>
            <button
              type="submit"
              name="decision"
              value="reject"
              style={{
                minHeight: "44px",
                padding: "0 1rem",
                fontWeight: 600,
                cursor: "pointer",
                background: "transparent",
                color: "var(--dry)",
                border: "1px solid var(--dry)",
                borderRadius: "0.5rem",
              }}
            >
              Reject
            </button>
          </div>
        </form>
      ) : null}
    </li>
  );
}

// --- Page ------------------------------------------------------------------------------------
export default async function AdminModerationPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { ok, who } = await isAuthorized();
  const { error } = await searchParams;

  if (!ok) {
    return (
      <Panel title="Moderation queue">
        <p>This console is restricted to moderators.</p>
        {adminTokenConfigured() ? (
          <form method="post" action="/admin/login" style={{ marginTop: "1rem" }}>
            <label htmlFor="admin-token" style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, marginBottom: "0.35rem" }}>
              Admin token
            </label>
            <input
              id="admin-token"
              name="token"
              type="password"
              autoComplete="current-password"
              style={{
                width: "100%",
                padding: "0.6rem 0.75rem",
                fontSize: "0.9rem",
                background: "var(--surface)",
                color: "var(--ink)",
                border: "1px solid var(--line-strong)",
                borderRadius: "0.5rem",
              }}
            />
            {error && (
              <p style={{ color: "var(--dry)", fontSize: "0.8rem", marginTop: "0.5rem" }}>
                {error === "rate"
                  ? "Too many attempts — try again in 15 minutes."
                  : "That token didn't match."}
              </p>
            )}
            <button
              type="submit"
              style={{
                marginTop: "0.75rem",
                minHeight: "44px",
                padding: "0 1.25rem",
                fontWeight: 700,
                cursor: "pointer",
                background: "var(--accent)",
                color: "#fff",
                border: "none",
                borderRadius: "0.5rem",
              }}
            >
              Unlock console
            </button>
          </form>
        ) : (
          <p style={{ marginTop: "0.75rem", color: "var(--ink-2)" }}>
            Set <code>ADMIN_TOKEN</code> (or configure Google sign-in with{" "}
            <code>ADMIN_EMAILS</code>) to enable access.
          </p>
        )}
        <p style={{ marginTop: "1rem", fontSize: "0.8rem", color: "var(--ink-3)" }}>
          Using Google instead?{" "}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- NextAuth API route, not a Next.js page */}
          <a href="/api/auth/signin" style={{ color: "var(--accent)", fontWeight: 600 }}>
            Sign in
          </a>{" "}
          with an account listed in <code>ADMIN_EMAILS</code>.
        </p>
      </Panel>
    );
  }

  let items: QueueItem[] = [];
  let dbUnavailable = false;
  try {
    items = await listQueue({});
  } catch (e) {
    if (e instanceof DbUnavailableError) {
      dbUnavailable = true;
    } else {
      throw e;
    }
  }

  if (dbUnavailable) {
    return (
      <Panel title="Moderation queue">
        <p>
          The database is not configured (<code>DATABASE_URL</code> is unset), so there is no
          moderation queue to review. Configure a database to enable writes and moderation.
        </p>
      </Panel>
    );
  }

  const pending = items.filter((i) => i.status === "pending").length;

  return (
    <main
      style={{
        maxWidth: "56rem",
        margin: "0 auto",
        padding: "2rem 1.25rem 4rem",
        color: "var(--ink)",
        background: "var(--bg)",
        minHeight: "100vh",
      }}
    >
      <header style={{ marginBottom: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 800 }}>Moderation queue</h1>
          <p style={{ color: "var(--ink-2)", marginTop: "0.25rem" }}>
            {pending} pending · {items.length} total. Signed in as {who}.
          </p>
        </div>
        <form method="post" action="/admin/logout">
          <button
            type="submit"
            style={{
              minHeight: "40px",
              padding: "0 0.9rem",
              fontSize: "0.8rem",
              fontWeight: 700,
              cursor: "pointer",
              background: "transparent",
              color: "var(--ink-2)",
              border: "1px solid var(--line-strong)",
              borderRadius: "0.5rem",
            }}
          >
            Log out
          </button>
        </form>
      </header>

      {items.length === 0 ? (
        <p style={{ color: "var(--ink-2)" }}>The queue is empty. Nothing to review right now.</p>
      ) : (
        <ul style={{ padding: 0, margin: 0 }}>
          {items.map((item) => (
            <QueueCard key={item.id} item={item} />
          ))}
        </ul>
      )}
    </main>
  );
}
