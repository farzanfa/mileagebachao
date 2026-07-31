"use client";

// The whole product on one screen, Google-Maps style: a full-viewport map with a pin
// for every known 100-octane pump, one floating search box, a small card for the
// selected pump, and a "+ Add a pump" button so anyone can report a pump they found
// selling XP100 / poWer 100 / Speed 100. Deliberately simple — no filters, no theme
// toggle, no side panels.

import { useMemo, useState } from "react";
import Link from "next/link";

import MapLibreMap from "@/components/map/MapLibreMap";
import type { Station } from "@/lib/types";

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

  function pick(id: string) {
    setSelectedId(id);
    setQuery("");
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
      />

      {/* Floating search card */}
      <div className={`absolute left-3 top-3 z-10 w-[min(380px,calc(100vw-24px))] ${CARD} p-3`}>
        <div className="mb-2 flex items-center gap-2">
          <span
            aria-hidden
            className="grid h-7 w-7 shrink-0 place-items-center rounded-lg font-mono text-[11px] font-bold text-white"
            style={{ background: "linear-gradient(150deg, var(--accent), var(--accent-ink))" }}
          >
            100
          </span>
          <div className="leading-tight">
            <div className="text-[15px] font-extrabold text-[var(--ink)]">
              Octane<span className="text-[var(--accent)]">Finder</span>
            </div>
            <div className="text-[10.5px] text-[var(--ink-3)]">
              Ethanol-free 100-octane petrol pumps in India
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
            onClick={() => setSelectedId(null)}
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
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${selected.lat},${selected.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex min-h-[42px] items-center rounded-lg bg-[var(--accent)] px-4 text-[13.5px] font-bold text-white hover:bg-[var(--accent-ink)]"
          >
            Directions ↗
          </a>
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
