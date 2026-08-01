// /admin — the MileageBachao operations dashboard.
// Stat tiles, brand/grade/state distributions (entity-colored bars with direct
// labels), recent edits, publish status, and the moderation queue. All server-
// rendered; decisions run through a server action re-gated by isAuthorized().

import type { ReactNode } from "react";

import { revalidatePath } from "next/cache";
import Link from "next/link";

import { DbUnavailableError } from "@/lib/api";
import { isAuthorized } from "@/lib/adminGate";
import { adminTokenConfigured } from "@/lib/adminToken";
import { decideQueue, listQueue, type QueueItem } from "@/lib/queries/admin";
import { adminStats, type AdminStats } from "@/lib/queries/adminStations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BRAND_VAR: Record<string, string> = {
  IOCL: "--brand-iocl",
  BPCL: "--brand-bpcl",
  HPCL: "--brand-hpcl",
};

const TYPE_LABEL: Record<QueueItem["type"], string> = {
  correction: "Correction",
  checkin: "Check-in",
  new_station: "New pump",
};

// --- Server action ---------------------------------------------------------------
async function decideAction(formData: FormData): Promise<void> {
  "use server";
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
  }
  revalidatePath("/admin");
}

// --- Presentational pieces --------------------------------------------------------
function Card({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--ink-3)]">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function StatTile({ label, value, tone }: { label: string; value: string; tone?: "accent" | "warn" }) {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5">
      <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--ink-3)]">{label}</div>
      <div
        className={`mt-1 text-[28px] font-extrabold leading-none tracking-tight tabular-nums ${
          tone === "accent" ? "text-[var(--accent)]" : tone === "warn" ? "text-[var(--stale)]" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function BarRow({
  label,
  sub,
  n,
  max,
  colorVar,
  href,
}: {
  label: string;
  sub?: string;
  n: number;
  max: number;
  colorVar: string;
  href?: string;
}) {
  const w = max > 0 ? Math.max(3, Math.round((n / max) * 100)) : 0;
  const text = (
    <span className="flex items-center gap-2 text-[13px] font-bold text-[var(--ink)]">
      <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: `var(${colorVar})` }} />
      {label}
      {sub && <span className="text-[10.5px] font-semibold text-[var(--ink-3)]">{sub}</span>}
    </span>
  );
  return (
    <div className="grid grid-cols-[9.5rem_1fr_2.5rem] items-center gap-3">
      {href ? <Link href={href} className="no-underline hover:opacity-80">{text}</Link> : text}
      <div className="h-2.5 overflow-hidden rounded-full bg-[var(--surface-2)]">
        <div className="h-full rounded-full" style={{ width: `${w}%`, background: `var(${colorVar})` }} />
      </div>
      <span className="text-right text-[13px] font-bold tabular-nums text-[var(--ink-2)]">{n}</span>
    </div>
  );
}

function StatusPill({ status }: { status: QueueItem["status"] }) {
  const map = {
    pending: ["--stale", "Pending"],
    approved: ["--fresh", "Approved"],
    rejected: ["--dry", "Rejected"],
  } as const;
  const [v, label] = map[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold"
      style={{ color: `var(${v})`, background: `color-mix(in srgb, var(${v}) 14%, transparent)` }}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: `var(${v})` }} />
      {label}
    </span>
  );
}

function QueueCard({ item }: { item: QueueItem }) {
  return (
    <li className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="rounded-lg bg-[var(--accent-soft)] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[var(--accent-ink)]">
            {TYPE_LABEL[item.type]}
          </span>
          <StatusPill status={item.status} />
        </div>
        <code className="text-[11px] text-[var(--ink-3)]">
          #{item.id} · {new Date(item.createdAt).toLocaleString()}
        </code>
      </div>

      <pre className="mt-3 overflow-x-auto rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-3 text-[12.5px] leading-relaxed text-[var(--ink-2)]">
        {JSON.stringify(item.payload, null, 2)}
      </pre>

      {item.status === "pending" && (
        <form action={decideAction} className="mt-3">
          <input type="hidden" name="id" value={item.id} />
          <label htmlFor={`note-${item.id}`} className="mb-1 block text-[11px] font-bold text-[var(--ink-2)]">
            Moderator note (optional)
          </label>
          <textarea
            id={`note-${item.id}`}
            name="note"
            rows={2}
            className="w-full resize-y rounded-lg border border-[var(--line-strong)] bg-[var(--bg)] p-2.5 text-[13px] text-[var(--ink)]"
          />
          <div className="mt-2.5 flex gap-2">
            <button
              type="submit"
              name="decision"
              value="approve"
              className="min-h-[42px] rounded-lg bg-[var(--fresh)] px-4 text-[13px] font-bold text-white hover:opacity-90"
            >
              Approve {item.type === "new_station" ? "& create pump" : ""}
            </button>
            <button
              type="submit"
              name="decision"
              value="reject"
              className="min-h-[42px] rounded-lg border border-[var(--dry)] px-4 text-[13px] font-bold text-[var(--dry)] hover:bg-[var(--surface-2)]"
            >
              Reject
            </button>
          </div>
        </form>
      )}
    </li>
  );
}

// --- Page -------------------------------------------------------------------------
export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { ok } = await isAuthorized();
  const { error } = await searchParams;

  if (!ok) {
    return (
      <main className="mx-auto max-w-md px-5 py-16">
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6">
          <h1 className="text-lg font-extrabold">Moderator access</h1>
          <p className="mt-1 text-[13px] text-[var(--ink-2)]">This console is restricted.</p>
          {adminTokenConfigured() ? (
            <form method="post" action="/admin/login" className="mt-5">
              <label htmlFor="admin-token" className="mb-1.5 block text-[12px] font-bold text-[var(--ink-2)]">
                Admin token
              </label>
              <input
                id="admin-token"
                name="token"
                type="password"
                autoComplete="current-password"
                className="w-full rounded-lg border border-[var(--line-strong)] bg-[var(--bg)] px-3 py-2.5 text-[14px] text-[var(--ink)]"
              />
              {error && (
                <p className="mt-2 text-[12px] font-semibold text-[var(--dry)]">
                  {error === "rate" ? "Too many attempts — try again in 15 minutes." : "That token didn't match."}
                </p>
              )}
              <button
                type="submit"
                className="mt-4 min-h-[44px] w-full rounded-lg bg-[var(--accent)] font-bold text-white hover:bg-[var(--accent-ink)]"
              >
                Unlock console
              </button>
            </form>
          ) : (
            <p className="mt-4 text-[13px] text-[var(--ink-2)]">
              Set <code>ADMIN_TOKEN</code> (or Google sign-in + <code>ADMIN_EMAILS</code>) to enable access.
            </p>
          )}
          <p className="mt-4 text-[12px] text-[var(--ink-3)]">
            Using Google?{" "}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- NextAuth API route */}
            <a href="/api/auth/signin" className="font-bold text-[var(--accent-ink)] underline">
              Sign in
            </a>
          </p>
        </div>
      </main>
    );
  }

  let items: QueueItem[] = [];
  let stats: AdminStats | null = null;
  try {
    [items, stats] = await Promise.all([listQueue({}), adminStats()]);
  } catch (e) {
    if (!(e instanceof DbUnavailableError)) throw e;
  }

  if (!stats) {
    return (
      <main className="mx-auto max-w-md px-5 py-16 text-[14px] text-[var(--ink-2)]">
        The database is not configured (<code>DATABASE_URL</code>), so there is nothing to manage.
      </main>
    );
  }

  const pendingItems = items.filter((i) => i.status === "pending");
  const decidedItems = items.filter((i) => i.status !== "pending").slice(0, 5);
  const maxBrand = Math.max(...stats.byBrand.map((b) => b.n), 1);
  const maxGrade = Math.max(...stats.byGrade.map((g) => g.n), 1);
  const maxState = Math.max(...stats.byState.map((s) => s.n), 1);
  const activeN = stats.byStatus.find((s) => s.status === "active")?.n ?? 0;

  return (
    <main className="mx-auto max-w-6xl px-5 py-8">
      {/* Stat tiles */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Pumps in database" value={String(stats.stations)} tone="accent" />
        <StatTile
          label="Pending reports"
          value={String(stats.pendingReports)}
          tone={stats.pendingReports > 0 ? "warn" : undefined}
        />
        <StatTile label="Active status" value={String(activeN)} />
        <StatTile label="Reports all-time" value={String(stats.totalReports)} />
      </section>

      {/* Distributions */}
      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card title="Network by company">
          <div className="grid gap-3">
            {stats.byBrand.map((b) => (
              <BarRow
                key={b.brand}
                label={b.brand}
                n={b.n}
                max={maxBrand}
                colorVar={BRAND_VAR[b.brand] ?? "--unknown"}
                href={`/admin/pumps?q=${b.brand}`}
              />
            ))}
          </div>
        </Card>
        <Card title="Pumps by fuel grade">
          <div className="grid gap-3">
            {stats.byGrade.map((g) => (
              <BarRow
                key={g.grade}
                label={g.grade}
                n={g.n}
                max={maxGrade}
                colorVar={BRAND_VAR[g.brand] ?? "--unknown"}
              />
            ))}
          </div>
        </Card>
        <Card title="Top states">
          <div className="grid gap-3">
            {stats.byState.map((s) => (
              <BarRow
                key={s.state}
                label={s.state}
                n={s.n}
                max={maxState}
                colorVar="--accent"
                href={`/admin/pumps?q=${encodeURIComponent(s.state)}`}
              />
            ))}
          </div>
        </Card>
      </section>

      {/* Activity + publish */}
      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card
          title="Recently edited pumps"
          action={
            <Link href="/admin/pumps" className="text-[12px] font-bold text-[var(--accent-ink)] no-underline hover:underline">
              All pumps →
            </Link>
          }
        >
          <ul className="divide-y divide-[var(--line)]">
            {stats.recentEdits.map((r) => (
              <li key={r.publicId}>
                <Link
                  href={`/admin/pumps/${encodeURIComponent(r.publicId)}`}
                  className="flex items-center justify-between gap-3 py-2.5 no-underline hover:opacity-80"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      aria-hidden
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: `var(${BRAND_VAR[r.brand] ?? "--unknown"})` }}
                    />
                    <span className="truncate text-[13px] font-bold text-[var(--ink)]">{r.name}</span>
                  </span>
                  <span className="shrink-0 text-[11.5px] tabular-nums text-[var(--ink-3)]">{r.updatedAt}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Publishing">
          <p className="text-[13px] leading-relaxed text-[var(--ink-2)]">
            The public map serves the committed dataset. Database edits and newly approved pumps go
            live on the next publish. <strong className="text-[var(--ink)]">Last DB edit: {stats.lastEdit ?? "—"}.</strong>
          </p>
          <pre className="mt-3 overflow-x-auto rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-3 text-[12px] text-[var(--ink-2)]">
{`npm run publish:data
git add data/ && git commit -m "publish" && git push`}
          </pre>
        </Card>
      </section>

      {/* Moderation queue */}
      <section className="mt-8">
        <h2 className="mb-3 text-[15px] font-extrabold">
          Moderation queue{" "}
          <span className="font-semibold text-[var(--ink-3)]">
            — {pendingItems.length} pending · {items.length} total
          </span>
        </h2>
        {pendingItems.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[var(--line-strong)] p-6 text-center text-[13px] text-[var(--ink-3)]">
            Queue clear — every report has been reviewed.
          </p>
        ) : (
          <ul className="grid gap-4">
            {pendingItems.map((item) => (
              <QueueCard key={item.id} item={item} />
            ))}
          </ul>
        )}
        {decidedItems.length > 0 && (
          <>
            <h3 className="mb-2 mt-6 text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--ink-3)]">
              Recently decided
            </h3>
            <ul className="grid gap-4">
              {decidedItems.map((item) => (
                <QueueCard key={item.id} item={item} />
              ))}
            </ul>
          </>
        )}
      </section>
    </main>
  );
}
