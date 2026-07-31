// /admin/pumps — searchable table of every station in the database, with edit links.
// DB-first: edits land in Postgres; the public map updates on the next publish
// (`npm run publish:data`). Requires admin (session or token cookie).

import Link from "next/link";

import { DbUnavailableError } from "@/lib/api";
import { isAuthorized } from "@/lib/adminGate";
import { listAdminStations, type AdminStationRow } from "@/lib/queries/adminStations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata = { title: "Pumps - Admin - MileageBachao", robots: { index: false, follow: false } };

const PAGE_SIZE = 50;

export default async function AdminPumpsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { ok } = await isAuthorized();
  if (!ok) {
    return (
      <main style={{ maxWidth: "40rem", margin: "4rem auto", padding: "0 1rem", color: "var(--ink)" }}>
        <p>
          Restricted. <Link href="/admin" style={{ color: "var(--accent)" }}>Log in at /admin</Link> first.
        </p>
      </main>
    );
  }

  const { q = "", page = "1" } = await searchParams;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);

  let rows: AdminStationRow[] = [];
  let total = 0;
  try {
    ({ rows, total } = await listAdminStations(q, PAGE_SIZE, (pageNum - 1) * PAGE_SIZE));
  } catch (e) {
    if (e instanceof DbUnavailableError) {
      return (
        <main style={{ maxWidth: "40rem", margin: "4rem auto", padding: "0 1rem", color: "var(--ink)" }}>
          <p>The database is not configured, so there are no pumps to manage.</p>
        </main>
      );
    }
    throw e;
  }
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const cell: React.CSSProperties = {
    padding: "0.5rem 0.6rem",
    borderBottom: "1px solid var(--line)",
    fontSize: "0.8rem",
    verticalAlign: "top",
  };

  return (
    <main style={{ maxWidth: "72rem", margin: "0 auto", padding: "2rem 1.25rem 4rem", color: "var(--ink)", background: "var(--bg)", minHeight: "100vh" }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", alignItems: "center", marginBottom: "1.25rem" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 800 }}>Pumps</h1>
          <p style={{ color: "var(--ink-2)", marginTop: "0.25rem", fontSize: "0.85rem" }}>
            {total} in database{q ? ` matching “${q}”` : ""}. Edits go live on the next publish.
          </p>
        </div>
        <Link href="/admin" style={{ color: "var(--accent)", fontWeight: 700, fontSize: "0.85rem" }}>
          ← Dashboard
        </Link>
      </header>

      <form method="get" style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", maxWidth: "28rem" }}>
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search name, city, state, PIN, id…"
          style={{ flex: 1, padding: "0.55rem 0.75rem", fontSize: "0.9rem", background: "var(--surface)", color: "var(--ink)", border: "1px solid var(--line-strong)", borderRadius: "0.5rem" }}
        />
        <button type="submit" style={{ minHeight: "42px", padding: "0 1rem", fontWeight: 700, cursor: "pointer", background: "var(--accent)", color: "#fff", border: "none", borderRadius: "0.5rem" }}>
          Search
        </button>
      </form>

      <div style={{ overflowX: "auto", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "0.75rem" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "56rem" }}>
          <thead>
            <tr>
              {["Pump", "Grades", "City", "State", "PIN", "Location", "Status", "Updated", ""].map((h) => (
                <th key={h} style={{ ...cell, textAlign: "left", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--ink-3)" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.publicId}>
                <td style={cell}>
                  <strong>{r.name}</strong>
                  <div style={{ color: "var(--ink-3)", fontSize: "0.7rem" }}>{r.brand} · {r.publicId}</div>
                </td>
                <td style={cell}>{r.grades || "—"}</td>
                <td style={cell}>{r.city ?? "—"}</td>
                <td style={cell}>{r.state}</td>
                <td style={cell}>{r.pincode ?? "—"}</td>
                <td style={{ ...cell, fontVariantNumeric: "tabular-nums" }}>
                  {r.lat !== null && r.lng !== null ? `${r.lat.toFixed(5)}, ${r.lng.toFixed(5)}` : "—"}
                </td>
                <td style={cell}>{r.status}</td>
                <td style={{ ...cell, whiteSpace: "nowrap" }}>{r.updatedAt}</td>
                <td style={cell}>
                  <Link href={`/admin/pumps/${encodeURIComponent(r.publicId)}`} style={{ color: "var(--accent)", fontWeight: 700 }}>
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <nav style={{ display: "flex", gap: "0.75rem", marginTop: "1rem", fontSize: "0.85rem" }}>
          {pageNum > 1 && (
            <Link href={`/admin/pumps?q=${encodeURIComponent(q)}&page=${pageNum - 1}`} style={{ color: "var(--accent)", fontWeight: 700 }}>
              ← Prev
            </Link>
          )}
          <span style={{ color: "var(--ink-2)" }}>Page {pageNum} of {pages}</span>
          {pageNum < pages && (
            <Link href={`/admin/pumps?q=${encodeURIComponent(q)}&page=${pageNum + 1}`} style={{ color: "var(--accent)", fontWeight: 700 }}>
              Next →
            </Link>
          )}
        </nav>
      )}
    </main>
  );
}
