// /admin/pumps/[id] — edit a station: name, address, city/state, PIN, phone,
// exact coordinates, and status. Saves via a server action into Postgres;
// the public map picks the change up on the next publish.

import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";

import { DbUnavailableError } from "@/lib/api";
import { isAuthorized } from "@/lib/adminGate";
import {
  getAdminStation,
  listStates,
  updateAdminStation,
} from "@/lib/queries/adminStations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata = { title: "Edit pump - Admin - MileageBachao", robots: { index: false, follow: false } };

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
  const bothOrNeither = (lat === null) === (lng === null);
  if (!latOk || !lngOk || !bothOrNeither) {
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
  redirect(`/admin/pumps/${encodeURIComponent(publicId)}?saved=1`);
}

const FIELD: React.CSSProperties = {
  width: "100%",
  padding: "0.55rem 0.7rem",
  fontSize: "0.9rem",
  background: "var(--surface)",
  color: "var(--ink)",
  border: "1px solid var(--line-strong)",
  borderRadius: "0.5rem",
};
const LABEL: React.CSSProperties = {
  display: "block",
  fontSize: "0.72rem",
  fontWeight: 700,
  color: "var(--ink-2)",
  marginBottom: "0.3rem",
};

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
      <main style={{ maxWidth: "40rem", margin: "4rem auto", padding: "0 1rem", color: "var(--ink)" }}>
        <p>
          Restricted. <Link href="/admin" style={{ color: "var(--accent)" }}>Log in at /admin</Link> first.
        </p>
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
      return (
        <main style={{ maxWidth: "40rem", margin: "4rem auto", padding: "0 1rem", color: "var(--ink)" }}>
          <p>The database is not configured.</p>
        </main>
      );
    }
    throw e;
  }
  if (!station) notFound();

  return (
    <main style={{ maxWidth: "44rem", margin: "0 auto", padding: "2rem 1.25rem 4rem", color: "var(--ink)", background: "var(--bg)", minHeight: "100vh" }}>
      <header style={{ marginBottom: "1.25rem" }}>
        <Link href="/admin/pumps" style={{ color: "var(--accent)", fontWeight: 700, fontSize: "0.85rem" }}>
          ← All pumps
        </Link>
        <h1 style={{ fontSize: "1.35rem", fontWeight: 800, marginTop: "0.5rem" }}>{station.name}</h1>
        <p style={{ color: "var(--ink-3)", fontSize: "0.8rem", marginTop: "0.2rem" }}>
          {station.brand} · {station.publicId}
          {station.roCode ? ` · RO ${station.roCode}` : ""} · grades: {station.grades || "—"}
        </p>
      </header>

      {saved && (
        <p style={{ background: "var(--accent-soft)", color: "var(--accent-ink)", padding: "0.6rem 0.9rem", borderRadius: "0.5rem", fontWeight: 700, fontSize: "0.85rem", marginBottom: "1rem" }}>
          Saved. The public map updates on the next publish (npm run publish:data).
        </p>
      )}
      {error && (
        <p style={{ background: "var(--surface)", border: "1px solid var(--dry)", color: "var(--ink)", padding: "0.6rem 0.9rem", borderRadius: "0.5rem", fontSize: "0.85rem", marginBottom: "1rem" }}>
          {error === "coords"
            ? "Coordinates must be inside India (lat 6–36, lng 68–97.5), and lat/lng must be set together."
            : "Save failed — check the values (state must be a real Indian state)."}
        </p>
      )}

      <form action={saveAction} style={{ display: "grid", gap: "0.9rem", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "0.75rem", padding: "1.25rem" }}>
        <input type="hidden" name="publicId" value={station.publicId} />
        <div>
          <label htmlFor="f-name" style={LABEL}>Pump name</label>
          <input id="f-name" name="name" defaultValue={station.name} required style={FIELD} />
        </div>
        <div>
          <label htmlFor="f-address" style={LABEL}>Address</label>
          <input id="f-address" name="address" defaultValue={station.address ?? ""} style={FIELD} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}>
          <div>
            <label htmlFor="f-city" style={LABEL}>City</label>
            <input id="f-city" name="city" defaultValue={station.city ?? ""} style={FIELD} />
          </div>
          <div>
            <label htmlFor="f-state" style={LABEL}>State</label>
            <select id="f-state" name="state" defaultValue={station.state} style={FIELD}>
              {states.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="f-pin" style={LABEL}>PIN code</label>
            <input id="f-pin" name="pincode" defaultValue={station.pincode ?? ""} maxLength={6} style={FIELD} />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
          <div>
            <label htmlFor="f-lat" style={LABEL}>Latitude</label>
            <input id="f-lat" name="lat" defaultValue={station.lat ?? ""} inputMode="decimal" style={FIELD} />
          </div>
          <div>
            <label htmlFor="f-lng" style={LABEL}>Longitude</label>
            <input id="f-lng" name="lng" defaultValue={station.lng ?? ""} inputMode="decimal" style={FIELD} />
          </div>
        </div>
        {station.lat !== null && station.lng !== null && (
          <p style={{ fontSize: "0.78rem", color: "var(--ink-3)", margin: 0 }}>
            Verify on{" "}
            <a
              href={`https://www.google.com/maps?q=${station.lat},${station.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--accent)", fontWeight: 700 }}
            >
              Google Maps ↗
            </a>{" "}
            — paste corrected coordinates back here if the pin is off.
          </p>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
          <div>
            <label htmlFor="f-phone" style={LABEL}>Phone</label>
            <input id="f-phone" name="phone" defaultValue={station.phone ?? ""} style={FIELD} />
          </div>
          <div>
            <label htmlFor="f-status" style={LABEL}>Status</label>
            <select id="f-status" name="status" defaultValue={station.status} style={FIELD}>
              {["unverified", "active", "temporarily_closed", "permanently_closed"].map((s) => (
                <option key={s} value={s}>{s.replaceAll("_", " ")}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <button
            type="submit"
            style={{ minHeight: "44px", padding: "0 1.5rem", fontWeight: 800, cursor: "pointer", background: "var(--accent)", color: "#fff", border: "none", borderRadius: "0.5rem" }}
          >
            Save changes
          </button>
        </div>
      </form>
    </main>
  );
}
