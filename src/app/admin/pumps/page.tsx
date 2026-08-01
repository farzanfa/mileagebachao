// /admin/pumps — searchable table of every station in the database.
// DB-first: edits go live on the next publish (npm run publish:data).

import Link from "next/link";

import { DbUnavailableError } from "@/lib/api";
import { isAuthorized } from "@/lib/adminGate";
import { listAdminStations, type AdminStationRow } from "@/lib/queries/adminStations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata = { title: "Pumps" };

const PAGE_SIZE = 50;

const BRAND_VAR: Record<string, string> = {
  IOCL: "--brand-iocl",
  BPCL: "--brand-bpcl",
  HPCL: "--brand-hpcl",
};
const STATUS_VAR: Record<string, string> = {
  active: "--fresh",
  unverified: "--unknown",
  temporarily_closed: "--stale",
  permanently_closed: "--dry",
  duplicate: "--dry",
};

export default async function AdminPumpsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { ok } = await isAuthorized();
  if (!ok) {
    return (
      <main className="mx-auto max-w-md px-5 py-16 text-[14px]">
        Restricted.{" "}
        <Link href="/admin" className="font-bold text-[var(--accent-ink)] underline">
          Log in at the dashboard
        </Link>{" "}
        first.
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
      return <main className="mx-auto max-w-md px-5 py-16 text-[14px]">Database not configured.</main>;
    }
    throw e;
  }
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="mx-auto max-w-6xl px-5 py-8">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">Pumps</h1>
          <p className="mt-0.5 text-[13px] text-[var(--ink-2)]">
            {total} in database{q ? <> matching <strong>“{q}”</strong></> : ""} · edits go live on the next publish
          </p>
        </div>
        <form method="get" className="flex w-full max-w-md gap-2">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search name, city, state, PIN, id…"
            className="min-w-0 flex-1 rounded-lg border border-[var(--line-strong)] bg-[var(--surface)] px-3 py-2.5 text-[14px] text-[var(--ink)]"
          />
          <button
            type="submit"
            className="min-h-[44px] rounded-lg bg-[var(--accent)] px-4 text-[13px] font-bold text-white hover:bg-[var(--accent-ink)]"
          >
            Search
          </button>
        </form>
      </header>

      <div className="overflow-x-auto rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
        <table className="w-full min-w-[58rem] border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-[var(--line)]">
              {["Pump", "Grades", "City", "State", "PIN", "Location", "Status", "Updated", ""].map((h) => (
                <th
                  key={h}
                  className="px-3 py-2.5 text-left text-[10.5px] font-bold uppercase tracking-[0.08em] text-[var(--ink-3)]"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)]">
            {rows.map((r) => (
              <tr key={r.publicId} className="hover:bg-[var(--surface-2)]">
                <td className="px-3 py-2.5">
                  <span className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: `var(${BRAND_VAR[r.brand] ?? "--unknown"})` }}
                    />
                    <span>
                      <strong className="block leading-tight">{r.name}</strong>
                      <span className="text-[10.5px] text-[var(--ink-3)]">
                        {r.brand} · {r.publicId}
                      </span>
                    </span>
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <span className="flex flex-wrap gap-1">
                    {(r.grades ? r.grades.split(", ") : []).map((g) => (
                      <span
                        key={g}
                        className="rounded-md border border-[var(--line)] bg-[var(--surface-2)] px-1.5 py-0.5 text-[11px] font-bold"
                      >
                        {g}
                      </span>
                    ))}
                  </span>
                </td>
                <td className="px-3 py-2.5">{r.city ?? "—"}</td>
                <td className="px-3 py-2.5">{r.state}</td>
                <td className="px-3 py-2.5 tabular-nums">{r.pincode ?? "—"}</td>
                <td className="px-3 py-2.5 tabular-nums">
                  {r.lat !== null && r.lng !== null ? `${r.lat.toFixed(4)}, ${r.lng.toFixed(4)}` : "—"}
                </td>
                <td className="px-3 py-2.5">
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold"
                    style={{
                      color: `var(${STATUS_VAR[r.status] ?? "--unknown"})`,
                      background: `color-mix(in srgb, var(${STATUS_VAR[r.status] ?? "--unknown"}) 13%, transparent)`,
                    }}
                  >
                    <span
                      aria-hidden
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: `var(${STATUS_VAR[r.status] ?? "--unknown"})` }}
                    />
                    {r.status.replaceAll("_", " ")}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-[var(--ink-3)]">{r.updatedAt}</td>
                <td className="px-3 py-2.5">
                  <Link
                    href={`/admin/pumps/${encodeURIComponent(r.publicId)}`}
                    className="font-bold text-[var(--accent-ink)] no-underline hover:underline"
                  >
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <nav className="mt-4 flex items-center gap-4 text-[13px]">
          {pageNum > 1 && (
            <Link
              href={`/admin/pumps?q=${encodeURIComponent(q)}&page=${pageNum - 1}`}
              className="font-bold text-[var(--accent-ink)]"
            >
              ← Prev
            </Link>
          )}
          <span className="text-[var(--ink-2)]">
            Page {pageNum} of {pages}
          </span>
          {pageNum < pages && (
            <Link
              href={`/admin/pumps?q=${encodeURIComponent(q)}&page=${pageNum + 1}`}
              className="font-bold text-[var(--accent-ink)]"
            >
              Next →
            </Link>
          )}
        </nav>
      )}
    </main>
  );
}
