"use client";

// The whole product on one screen, Google-Maps style: a full-viewport map with a pin
// for every known 100-octane pump, one floating search box, a small card for the
// selected pump, and a "+ Add a pump" button so anyone can report a pump they found
// selling XP100 / poWer 100 / Speed 100. Deliberately simple — no filters, no theme
// toggle, no side panels.

import { useMemo, useState } from "react";
import Link from "next/link";

import BrandMark from "@/components/BrandMark";
import MapLibreMap from "@/components/map/MapLibreMap";
import { haversineKm } from "@/lib/geo";
import { fetchRoute, type RouteResult } from "@/lib/routing";
import type { Coord, Station } from "@/lib/types";

const FUELS = ["XP100", "poWer 100", "Speed 100", "poWer 99", "Speed 97", "Not sure"] as const;

const BRAND_LABEL: Record<Station["brand"], string> = {
  IOCL: "IndianOil",
  HPCL: "HP",
  BPCL: "Bharat Petroleum",
};

const CARD =
  "rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-[0_2px_10px_rgba(16,24,25,.12)]";
const INPUT =
  "w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[14px] text-[var(--ink)] outline-none focus:border-[var(--accent)]";
const LABEL = "mb-1 block text-[12px] font-bold text-[var(--ink-2)]";

interface SimpleMapHomeProps {
  stations: Station[];
  styleUrl: string;
}

interface SuggestForm {
  fuel: (typeof FUELS)[number];
  pumpName: string;
  city: string;
  area: string;
  state: string;
  note: string;
  contact: string;
}

const EMPTY_FORM: SuggestForm = {
  fuel: "XP100",
  pumpName: "",
  city: "",
  area: "",
  state: "",
  note: "",
  contact: "",
};

export default function SimpleMapHome({ stations, styleUrl }: SimpleMapHomeProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<SuggestForm>(EMPTY_FORM);
  const [submitState, setSubmitState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [submitMessage, setSubmitMessage] = useState("");
  const [userLoc, setUserLoc] = useState<Coord | null>(null);
  const [locState, setLocState] = useState<"idle" | "locating" | "error">("idle");
  const [locError, setLocError] = useState("");
  const [showNearest, setShowNearest] = useState(false);
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [routeState, setRouteState] = useState<"idle" | "loading" | "error">("idle");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return stations
      .filter((s) =>
        `${s.name} ${s.address} ${s.city} ${s.state} ${s.pincode}`.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [stations, query]);

  const selected = selectedId ? stations.find((s) => s.id === selectedId) ?? null : null;

  const nearest = useMemo(() => {
    if (!userLoc) return [];
    return stations
      .map((s) => ({ s, km: haversineKm(userLoc, { lat: s.lat, lng: s.lng }) }))
      .sort((a, b) => a.km - b.km)
      .slice(0, 5);
  }, [stations, userLoc]);

  function pick(id: string) {
    setSelectedId(id);
    setQuery("");
    setRoute(null);
    setRouteState("idle");
  }

  async function showRoute(station: Station) {
    if (!userLoc) return;
    setRouteState("loading");
    const r = await fetchRoute(userLoc, { lat: station.lat, lng: station.lng });
    if (r) {
      setRoute(r);
      setRouteState("idle");
    } else {
      setRoute(null);
      setRouteState("error");
    }
  }

  function locate() {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setLocState("error");
      setLocError("Your browser doesn't support location.");
      return;
    }
    setLocState("locating");
    setLocError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // Client-side only: the coordinates never leave this device.
        setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocState("idle");
        setSelectedId(null);
        setShowNearest(true);
      },
      (geoErr) => {
        setLocState("error");
        setLocError(
          geoErr.code === geoErr.PERMISSION_DENIED
            ? "Location access was denied. Allow location for this site and try again."
            : "Couldn't get your location. Please try again.",
        );
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  async function submitSuggestion() {
    setSubmitState("sending");
    setSubmitMessage("");
    try {
      const res = await fetch("/api/v1/suggest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fuel: form.fuel,
          pumpName: form.pumpName,
          city: form.city,
          area: form.area || undefined,
          state: form.state,
          note: form.note || undefined,
          contact: form.contact || undefined,
        }),
      });
      if (res.status === 202) {
        setSubmitState("done");
        setForm(EMPTY_FORM);
        return;
      }
      const body = (await res.json().catch(() => null)) as {
        error?: { code?: string; message?: string };
      } | null;
      setSubmitState("error");
      setSubmitMessage(
        body?.error?.code === "db_unavailable"
          ? "Submissions aren't switched on for this deployment yet — the site owner needs to connect a database."
          : body?.error?.message || "Something went wrong. Please try again.",
      );
    } catch {
      setSubmitState("error");
      setSubmitMessage("Network error. Please try again.");
    }
  }

  const formValid =
    form.pumpName.trim().length >= 3 && form.city.trim().length >= 2 && form.state.trim().length >= 2;

  return (
    <div className="fixed inset-0 overflow-hidden bg-[var(--map-ocean)]">
      <MapLibreMap
        stations={stations}
        selectedId={selectedId}
        onSelectStation={pick}
        styleUrl={styleUrl}
        userLocation={userLoc}
        routeGeometry={route?.geometry ?? null}
      />

      {/* Floating search card */}
      <div className={`absolute left-3 top-3 z-10 w-[min(380px,calc(100vw-24px))] ${CARD} p-3`}>
        <div className="mb-2 flex items-center gap-2">
          <BrandMark size={30} />
          <div className="leading-tight">
            <div className="text-[15px] font-extrabold text-[var(--ink)]">
              Mileage<span className="text-[var(--accent)]">Bachao</span>
            </div>
            <div className="text-[10.5px] text-[var(--ink-3)]">
              Mileage bachao, E0 bharao — 100-octane pump map
            </div>
          </div>
        </div>

        <input
          type="search"
          role="searchbox"
          aria-label="Search pumps by city, area or pincode"
          placeholder="Search city, area or pincode…"
          className={INPUT}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        {results.length > 0 && (
          <ul className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-[var(--line)]">
            {results.map((s) => (
              <li key={s.id} className="border-b border-[var(--line)] last:border-b-0">
                <button
                  type="button"
                  onClick={() => pick(s.id)}
                  className="block w-full px-3 py-2 text-left hover:bg-[var(--surface-2)]"
                >
                  <span className="block text-[13px] font-bold text-[var(--ink)]">{s.name}</span>
                  <span className="block text-[11.5px] text-[var(--ink-3)]">
                    {s.city}, {s.state} · {s.grades.map((g) => g.grade).join(", ")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {query.trim().length >= 2 && results.length === 0 && (
          <p className="mt-2 text-[12px] text-[var(--ink-3)]">
            No pumps found here yet — know one?{" "}
            <button
              type="button"
              className="font-bold text-[var(--accent-ink)] underline"
              onClick={() => {
                setShowAdd(true);
                setSubmitState("idle");
              }}
            >
              Add it
            </button>
            .
          </p>
        )}

        <p className="mt-2 text-[10.5px] text-[var(--ink-3)]">
          <Link href="/about" className="underline">
            About
          </Link>{" "}
          ·{" "}
          <Link href="/attribution" className="underline">
            Attribution
          </Link>{" "}
          ·{" "}
          <Link href="/privacy" className="underline">
            Privacy
          </Link>
        </p>
      </div>

      {/* Locate-me (GPS) button */}
      <button
        type="button"
        aria-label="Find pumps near me"
        title="Find pumps near me"
        disabled={locState === "locating"}
        onClick={locate}
        className="absolute bottom-[92px] right-4 z-10 grid h-[48px] w-[48px] place-items-center rounded-full border border-[var(--line)] bg-[var(--surface)] text-[var(--accent-ink)] shadow-[0_4px_16px_rgba(16,24,25,.25)] hover:bg-[var(--surface-2)] disabled:opacity-60"
      >
        {locState === "locating" ? (
          <span
            aria-hidden
            className="block h-5 w-5 animate-spin rounded-full border-2 border-[var(--line-strong)] border-t-[var(--accent)]"
          />
        ) : (
          <svg
            aria-hidden
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <circle cx="12" cy="12" r="3.2" fill="currentColor" stroke="none" />
            <circle cx="12" cy="12" r="7.5" />
            <path d="M12 1.8v3M12 19.2v3M1.8 12h3M19.2 12h3" />
          </svg>
        )}
      </button>

      {/* Location error toast */}
      {locState === "error" && (
        <div
          role="alert"
          className={`absolute bottom-[152px] right-4 z-10 w-[min(300px,calc(100vw-24px))] ${CARD} p-3 text-[12.5px] text-[var(--ink)]`}
        >
          {locError}
          <button
            type="button"
            onClick={() => setLocState("idle")}
            className="mt-2 block text-[12px] font-bold text-[var(--accent-ink)] underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Add a pump button */}
      <button
        type="button"
        onClick={() => {
          setShowAdd(true);
          setSubmitState("idle");
        }}
        className="absolute bottom-6 right-4 z-10 flex min-h-[48px] items-center gap-2 rounded-full bg-[var(--accent)] px-5 text-[14px] font-bold text-white shadow-[0_4px_16px_rgba(16,24,25,.25)] hover:bg-[var(--accent-ink)]"
      >
        <span aria-hidden className="text-[18px] leading-none">
          +
        </span>
        Add a pump
      </button>

      {/* Nearest pumps panel (after locating) */}
      {showNearest && userLoc && !selected && nearest.length > 0 && (
        <div
          className={`absolute bottom-6 left-3 z-10 w-[min(380px,calc(100vw-24px))] ${CARD} p-4`}
          role="dialog"
          aria-label="Nearest pumps to your location"
        >
          <button
            type="button"
            aria-label="Close nearest pumps"
            onClick={() => setShowNearest(false)}
            className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-lg text-[var(--ink-3)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
          >
            ✕
          </button>
          <h2 className="text-[14px] font-extrabold text-[var(--ink)]">Nearest pumps to you</h2>
          <ul className="mt-2 divide-y divide-[var(--line)]">
            {nearest.map(({ s, km }) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => pick(s.id)}
                  className="flex w-full items-baseline justify-between gap-3 px-1 py-2 text-left hover:bg-[var(--surface-2)]"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-bold text-[var(--ink)]">
                      {s.name}
                    </span>
                    <span className="block text-[11.5px] text-[var(--ink-3)]">
                      {s.city}, {s.state}
                    </span>
                  </span>
                  <span className="shrink-0 text-[12.5px] font-bold text-[var(--accent-ink)]">
                    {km < 10 ? km.toFixed(1) : Math.round(km)} km
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[10.5px] text-[var(--ink-3)]">
            Straight-line (aerial) distance · your location never leaves this device.
          </p>
        </div>
      )}

      {/* Selected pump card */}
      {selected && (
        <div
          className={`absolute bottom-6 left-3 z-10 w-[min(380px,calc(100vw-24px))] ${CARD} p-4`}
          role="dialog"
          aria-label={`${selected.name} details`}
        >
          <button
            type="button"
            aria-label="Close"
            onClick={() => {
              setSelectedId(null);
              setRoute(null);
              setRouteState("idle");
            }}
            className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-lg text-[var(--ink-3)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
          >
            ✕
          </button>
          <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)]">
            {BRAND_LABEL[selected.brand]}
          </div>
          <h2 className="mt-0.5 pr-8 text-[16px] font-extrabold leading-snug text-[var(--ink)]">
            {selected.name}
          </h2>
          <p className="mt-1 text-[12.5px] text-[var(--ink-2)]">
            {selected.address}, {selected.city}, {selected.state}
            {selected.pincode ? ` ${selected.pincode}` : ""}
          </p>
          {userLoc && (
            <p className="mt-1 text-[12px] font-bold text-[var(--accent-ink)]">
              {route
                ? `${route.distanceKm.toFixed(1)} km by road · ~${route.durationMin} min drive`
                : `${haversineKm(userLoc, { lat: selected.lat, lng: selected.lng }).toFixed(1)} km from you`}{" "}
              {!route && <span className="font-normal text-[var(--ink-3)]">(aerial)</span>}
            </p>
          )}
          {routeState === "error" && (
            <p className="mt-1 text-[11.5px] text-[var(--dry)]">
              Couldn&apos;t fetch the road route right now — the Directions button still works.
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {selected.grades.map((g) => (
              <span
                key={g.grade}
                className="rounded-md border border-[var(--line)] bg-[var(--surface-2)] px-2 py-0.5 text-[11.5px] font-bold text-[var(--ink)]"
              >
                {g.grade}
              </span>
            ))}
            {selected.lastVerified === null && (
              <span className="rounded-md border border-dashed border-[var(--unknown)] px-2 py-0.5 text-[10.5px] font-bold text-[var(--unknown)]">
                Unverified — official listing
              </span>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {userLoc ? (
              <button
                type="button"
                disabled={routeState === "loading"}
                onClick={() => void showRoute(selected)}
                className="inline-flex min-h-[42px] items-center rounded-lg border border-[var(--accent)] px-4 text-[13.5px] font-bold text-[var(--accent-ink)] hover:bg-[var(--accent-soft)] disabled:opacity-60"
              >
                {routeState === "loading"
                  ? "Finding route…"
                  : route
                    ? "Route shown ↺"
                    : "Show route on map"}
              </button>
            ) : (
              <button
                type="button"
                onClick={locate}
                className="inline-flex min-h-[42px] items-center rounded-lg border border-[var(--line)] px-4 text-[13px] font-bold text-[var(--ink-2)] hover:bg-[var(--surface-2)]"
              >
                📍 Locate me for the route
              </button>
            )}
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${selected.lat},${selected.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[42px] items-center rounded-lg bg-[var(--accent)] px-4 text-[13.5px] font-bold text-white hover:bg-[var(--accent-ink)]"
            >
              Navigate ↗
            </a>
          </div>
        </div>
      )}

      {/* Add-a-pump modal */}
      {showAdd && (
        <div
          className="absolute inset-0 z-20 grid place-items-center bg-[rgba(6,12,13,.45)] p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Add a pump"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAdd(false);
          }}
        >
          <div className={`max-h-[90dvh] w-[min(420px,100%)] overflow-y-auto ${CARD} p-5`}>
            {submitState === "done" ? (
              <div className="text-center">
                <div className="text-[28px]" aria-hidden>
                  ✅
                </div>
                <h2 className="mt-1 text-[17px] font-extrabold text-[var(--ink)]">Thank you!</h2>
                <p className="mt-1 text-[13px] text-[var(--ink-2)]">
                  Your pump has been submitted. We review every report before it appears on the map.
                </p>
                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="mt-4 min-h-[44px] rounded-lg bg-[var(--accent)] px-5 text-[14px] font-bold text-white hover:bg-[var(--accent-ink)]"
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                <h2 className="text-[17px] font-extrabold text-[var(--ink)]">Add a pump</h2>
                <p className="mt-1 text-[12.5px] text-[var(--ink-2)]">
                  Found a pump selling XP100, poWer 100 or Speed 100? Tell us where — we&apos;ll
                  verify and put it on the map.
                </p>

                <div className="mt-4 grid gap-3">
                  <div>
                    <label htmlFor="sg-fuel" className={LABEL}>
                      Which fuel did you find?
                    </label>
                    <select
                      id="sg-fuel"
                      className={INPUT}
                      value={form.fuel}
                      onChange={(e) =>
                        setForm({ ...form, fuel: e.target.value as SuggestForm["fuel"] })
                      }
                    >
                      {FUELS.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="sg-name" className={LABEL}>
                      Pump name *
                    </label>
                    <input
                      id="sg-name"
                      className={INPUT}
                      placeholder="e.g. IndianOil, SR Fuels, Padivattom"
                      value={form.pumpName}
                      onChange={(e) => setForm({ ...form, pumpName: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="sg-city" className={LABEL}>
                        City / town *
                      </label>
                      <input
                        id="sg-city"
                        className={INPUT}
                        placeholder="Kochi"
                        value={form.city}
                        onChange={(e) => setForm({ ...form, city: e.target.value })}
                      />
                    </div>
                    <div>
                      <label htmlFor="sg-state" className={LABEL}>
                        State *
                      </label>
                      <input
                        id="sg-state"
                        className={INPUT}
                        placeholder="Kerala"
                        value={form.state}
                        onChange={(e) => setForm({ ...form, state: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="sg-area" className={LABEL}>
                      Area / landmark
                    </label>
                    <input
                      id="sg-area"
                      className={INPUT}
                      placeholder="e.g. Vytilla Junction, near metro"
                      value={form.area}
                      onChange={(e) => setForm({ ...form, area: e.target.value })}
                    />
                  </div>
                  <div>
                    <label htmlFor="sg-note" className={LABEL}>
                      Anything else?
                    </label>
                    <textarea
                      id="sg-note"
                      className={`${INPUT} min-h-[64px] resize-y`}
                      placeholder="e.g. Saw the XP100 dispenser today, ₹160/L"
                      value={form.note}
                      onChange={(e) => setForm({ ...form, note: e.target.value })}
                    />
                  </div>
                  <div>
                    <label htmlFor="sg-contact" className={LABEL}>
                      Your contact (optional, in case we have questions)
                    </label>
                    <input
                      id="sg-contact"
                      className={INPUT}
                      placeholder="email or phone"
                      value={form.contact}
                      onChange={(e) => setForm({ ...form, contact: e.target.value })}
                    />
                  </div>
                </div>

                {submitState === "error" && (
                  <p className="mt-3 rounded-lg border border-[var(--dry)] bg-[var(--surface-2)] px-3 py-2 text-[12.5px] text-[var(--ink)]">
                    {submitMessage}
                  </p>
                )}

                <div className="mt-4 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAdd(false)}
                    className="min-h-[44px] rounded-lg border border-[var(--line)] px-4 text-[14px] font-bold text-[var(--ink-2)] hover:bg-[var(--surface-2)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!formValid || submitState === "sending"}
                    onClick={() => void submitSuggestion()}
                    className="min-h-[44px] rounded-lg bg-[var(--accent)] px-5 text-[14px] font-bold text-white hover:bg-[var(--accent-ink)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitState === "sending" ? "Submitting…" : "Submit pump"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
