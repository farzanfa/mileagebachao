// /admin/pumps/[id] — edit a station: identity, address, exact coordinates,
// contact, and status. Server-action save gated by isAuthorized(); the public
// map picks changes up on the next publish.

import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";

import { DbUnavailableError } from "@/lib/api";
import { isAuthorized } from "@/lib/adminGate";
import { getAdminStation, listStates, updateAdminStation } from "@/lib/queries/adminStations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata = { title: "Edit pump" };

const BRAND_VAR: Record<string, string> = {
  IOCL: "--brand-iocl",
  BPCL: "--brand-bpcl",
  HPCL: "--brand-hpcl",
};

async function saveAction(formData: FormData): Promise<void> {
  "use server";
  const { ok } = await isAuthorized();
  if (!ok) return;

  const publicId = String(formData.get("publicId") ?? "");
  if (!publicId) return;
  const num = (v: FormDataEntryValue | null): number | null => {
    const s = String(v ?? "").trim();
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  };
  const lat = num(formData.get("lat"));
  const lng = num(formData.get("lng"));
  const latOk = lat === null || (lat >= 6 && lat <= 36);
  const lngOk = lng === null || (lng >= 68 && lng <= 97.5);
  if (!latOk || !lngOk || (lat === null) !== (lng === null)) {
    redirect(`/admin/pumps/${encodeURIComponent(publicId)}?error=coords`);
  }

  try {
    await updateAdminStation(publicId, {
      name: String(formData.get("name") ?? ""),
      address: String(formData.get("address") ?? ""),
      city: String(formData.get("city") ?? ""),
      state: String(formData.get("state") ?? ""),
      pincode: String(formData.get("pincode") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      lat,
      lng,
      status: String(formData.get("status") ?? "unverified"),
    });
  } catch {
    redirect(`/admin/pumps/${encodeURIComponent(publicId)}?error=save`);
  }
  revalidatePath("/admin/pumps");
  revalidatePath("/admin");
  redirect(`/admin/pumps/${encodeURIComponent(publicId)}?saved=1`);
}

const FIELD =
  "w-full rounded-lg border border-[var(--line-strong)] bg-[var(--bg)] px-3 py-2.5 text-[14px] text-[var(--ink)]";
const LABEL = "mb-1 block text-[11.5px] font-bold text-[var(--ink-2)]";

export default async function EditPumpPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
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

  const { id } = await params;
  const { saved, error } = await searchParams;

  let station;
  let states: string[] = [];
  try {
    station = await getAdminStation(decodeURIComponent(id));
    states = await listStates();
  } catch (e) {
    if (e instanceof DbUnavailableError) {
      return <main className="mx-auto max-w-md px-5 py-16 text-[14px]">Database not configured.</main>;
    }
    throw e;
  }
  if (!station) notFound();

  return (
    <main className="mx-auto max-w-2xl px-5 py-8">
      <Link href="/admin/pumps" className="text-[13px] font-bold text-[var(--accent-ink)] no-underline hover:underline">
        ← All pumps
      </Link>

      <header className="mb-5 mt-3">
        <h1 className="flex items-center gap-2.5 text-xl font-extrabold tracking-tight">
          <span
            aria-hidden
            className="h-3 w-3 shrink-0 rounded-full"
            style={{ background: `var(${BRAND_VAR[station.brand] ?? "--unknown"})` }}
          />
          {station.name}
        </h1>
        <p className="mt-1 text-[12px] text-[var(--ink-3)]">
          {station.brand} · {station.publicId}
          {station.roCode ? ` · RO ${station.roCode}` : ""} · grades: {station.grades || "—"}
        </p>
      </header>

      {saved && (
        <p className="mb-4 rounded-xl bg-[var(--accent-soft)] px-4 py-3 text-[13px] font-bold text-[var(--accent-ink)]">
          Saved ✓ — goes live on the next publish (<code>npm run publish:data</code>).
        </p>
      )}
      {error && (
        <p className="mb-4 rounded-xl border border-[var(--dry)] bg-[var(--surface)] px-4 py-3 text-[13px] text-[var(--ink)]">
          {error === "coords"
            ? "Coordinates must be inside India (lat 6–36, lng 68–97.5) and set as a pair."
            : "Save failed — check the values (state must be a real Indian state)."}
        </p>
      )}

      <form
        action={saveAction}
        className="grid gap-4 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6"
      >
        <input type="hidden" name="publicId" value={station.publicId} />
        <div>
          <label htmlFor="f-name" className={LABEL}>Pump name</label>
          <input id="f-name" name="name" defaultValue={station.name} required className={FIELD} />
        </div>
        <div>
          <label htmlFor="f-address" className={LABEL}>Address</label>
          <input id="f-address" name="address" defaultValue={station.address ?? ""} className={FIELD} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="f-city" className={LABEL}>City</label>
            <input id="f-city" name="city" defaultValue={station.city ?? ""} className={FIELD} />
          </div>
          <div>
            <label htmlFor="f-state" className={LABEL}>State</label>
            <select id="f-state" name="state" defaultValue={station.state} className={FIELD}>
              {states.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="f-pin" className={LABEL}>PIN code</label>
            <input id="f-pin" name="pincode" defaultValue={station.pincode ?? ""} maxLength={6} className={FIELD} />
          </div>
        </div>

        <fieldset className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-4">
          <legend className="px-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--ink-3)]">
            Exact location
          </legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="f-lat" className={LABEL}>Latitude</label>
              <input id="f-lat" name="lat" defaultValue={station.lat ?? ""} inputMode="decimal" className={FIELD} />
            </div>
            <div>
              <label htmlFor="f-lng" className={LABEL}>Longitude</label>
              <input id="f-lng" name="lng" defaultValue={station.lng ?? ""} inputMode="decimal" className={FIELD} />
            </div>
          </div>
          {station.lat !== null && station.lng !== null && (
            <p className="mt-3 text-[12px] text-[var(--ink-3)]">
              Check the pin on{" "}
              <a
                href={`https://www.google.com/maps?q=${station.lat},${station.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-[var(--accent-ink)] underline"
              >
                Google Maps ↗
              </a>{" "}
              — if it&apos;s off, copy the correct coordinates from Maps (right-click the pump →
              copy numbers) and paste them here.
            </p>
          )}
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="f-phone" className={LABEL}>Phone</label>
            <input id="f-phone" name="phone" defaultValue={station.phone ?? ""} className={FIELD} />
          </div>
          <div>
            <label htmlFor="f-status" className={LABEL}>Status</label>
            <select id="f-status" name="status" defaultValue={station.status} className={FIELD}>
              {["unverified", "active", "temporarily_closed", "permanently_closed"].map((s) => (
                <option key={s} value={s}>{s.replaceAll("_", " ")}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <button
            type="submit"
            className="min-h-[46px] rounded-lg bg-[var(--accent)] px-6 text-[14px] font-extrabold text-white hover:bg-[var(--accent-ink)]"
          >
            Save changes
          </button>
        </div>
      </form>
    </main>
  );
}
