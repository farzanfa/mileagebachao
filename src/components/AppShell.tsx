"use client";

// AppShell (BUILD-CONTRACT §8; design §4.5.3 / §4.6).
// Client owner of FilterState. It:
//  - filters the seed stations (grade + brand + "E0 only" + free-text query),
//  - computes aerial distance from the selected origin via geo.haversineKm,
//  - sorts by distance or recency (SortKey),
//  - wires Filters + MapLibreMap + StationList + StationDetail,
//  - provides the responsive map/list toggle below the `lg` breakpoint.
//
// The map style URL comes from NEXT_PUBLIC_MAP_STYLE_URL (inlined at build). AppShell's
// prop shape is fixed by the contract, so the URL is read internally rather than passed.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";

import type {
  Brand,
  BrandMeta,
  FilterState,
  GradeMeta,
  GradeName,
  OriginCity,
  Station,
  StationWithDistance,
} from "@/lib/types";
import { haversineKm } from "@/lib/geo";
import { ALL_BRANDS, LEGACY_GRADES, PRIMARY_GRADES } from "@/lib/constants";

import Filters from "@/components/Filters";
import StationList from "@/components/StationList";
import StationDetail from "@/components/StationDetail";
import MapLibreMap from "@/components/map/MapLibreMap";

export interface AppShellProps {
  initialStations: Station[];
  gradeMeta: Record<GradeName, GradeMeta>;
  brandMeta: Record<Brand, BrandMeta>;
  origins: OriginCity[];
}

/** Default filter: the three 100-RON E0 grades on, legacy grades opt-in (design §4.5.4). */
function buildInitialFilter(origins: OriginCity[]): FilterState {
  const grades = {} as Record<GradeName, boolean>;
  for (const g of PRIMARY_GRADES) grades[g] = true;
  for (const g of LEGACY_GRADES) grades[g] = false;
  const brands = {} as Record<Brand, boolean>;
  for (const b of ALL_BRANDS) brands[b] = true;
  return {
    grades,
    brands,
    e0Only: false,
    query: "",
    originId: origins[0]?.id ?? "",
    sort: "dist",
  };
}

function minVerifiedDays(s: Station): number {
  let m = Number.POSITIVE_INFINITY;
  for (const g of s.grades) {
    const d = g.lastVerifiedDays;
    if (d !== null && d < m) m = d;
  }
  return m;
}

const viewSwitchWrap: CSSProperties = {
  background: "var(--surface-2)",
  border: "1px solid var(--line)",
  borderRadius: 999,
  padding: 3,
  gap: 2,
};

function viewSwitchBtn(active: boolean): CSSProperties {
  return {
    border: 0,
    background: active ? "var(--accent)" : "transparent",
    color: active ? "var(--accent-contrast)" : "var(--ink-3)",
    fontWeight: 750,
    fontSize: 12.5,
    padding: "6px 14px",
    borderRadius: 999,
    cursor: "pointer",
  };
}

export default function AppShell({
  initialStations,
  gradeMeta,
  brandMeta,
  origins,
}: AppShellProps) {
  const [filter, setFilter] = useState<FilterState>(() => buildInitialFilter(origins));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"map" | "list">("list");
  const detailRef = useRef<HTMLElement | null>(null);

  const origin = useMemo(
    () => origins.find((o) => o.id === filter.originId) ?? origins[0] ?? null,
    [origins, filter.originId],
  );

  const results = useMemo<StationWithDistance[]>(() => {
    const q = filter.query.trim().toLowerCase();
    const out: StationWithDistance[] = [];

    for (const s of initialStations) {
      if (!filter.brands[s.brand]) continue;
      if (q) {
        const hay = `${s.name} ${s.city} ${s.state} ${s.pincode} ${s.address}`.toLowerCase();
        if (!hay.includes(q)) continue;
      }

      let hasVisibleGrade = false;
      for (const g of s.grades) {
        if (!filter.grades[g.grade]) continue;
        if (filter.e0Only) {
          const gm = gradeMeta[g.grade];
          if (!gm || gm.e0 !== true) continue;
        }
        hasVisibleGrade = true;
        break;
      }
      if (!hasVisibleGrade) continue;

      const distanceKm = origin
        ? haversineKm({ lat: origin.lat, lng: origin.lng }, { lat: s.lat, lng: s.lng })
        : 0;
      out.push({ ...s, distanceKm });
    }

    if (filter.sort === "dist") {
      out.sort((a, b) => a.distanceKm - b.distanceKm);
    } else {
      out.sort((a, b) => minVerifiedDays(a) - minVerifiedDays(b));
    }
    return out;
  }, [initialStations, filter, origin, gradeMeta]);

  const selectedStation = useMemo(
    () => (selectedId ? initialStations.find((s) => s.id === selectedId) ?? null : null),
    [initialStations, selectedId],
  );

  const handleSelect = useCallback((id: string) => setSelectedId(id), []);
  const handleClose = useCallback(() => setSelectedId(null), []);

  // Esc closes the detail overlay; focus moves into it on open (WCAG 2.4.3 / 2.4.11).
  useEffect(() => {
    if (!selectedStation) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedId(null);
    };
    document.addEventListener("keydown", onKey);
    detailRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [selectedStation]);

  const emptyCities = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const s of initialStations) {
      if (seen.has(s.city)) continue;
      seen.add(s.city);
      list.push(s.city);
      if (list.length >= 5) break;
    }
    return list;
  }, [initialStations]);

  const styleUrl = process.env.NEXT_PUBLIC_MAP_STYLE_URL || "";
  const originLabel = origin ? origin.name.split(" (")[0] : "";

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: "1 1 auto", minHeight: 0 }}>
      {/* filter controls */}
      <div style={{ background: "var(--surface)", borderBottom: "1px solid var(--line)" }}>
        <Filters
          value={filter}
          onChange={setFilter}
          gradeMeta={gradeMeta}
          brandMeta={brandMeta}
          origins={origins}
        />
      </div>

      {/* result count + mobile view toggle */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "10px 16px",
          background: "var(--surface)",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <p aria-live="polite" style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>
          {results.length} {results.length === 1 ? "station" : "stations"}
          {origin && (
            <span style={{ color: "var(--ink-3)", fontWeight: 500 }}>
              {" · near "}
              {originLabel}
              {" · sorted by "}
              {filter.sort === "dist" ? "distance" : "recency"}
            </span>
          )}
        </p>
        <div className="flex lg:hidden" role="group" aria-label="Show list or map" style={viewSwitchWrap}>
          <button
            type="button"
            aria-pressed={mobileView === "list"}
            onClick={() => setMobileView("list")}
            style={viewSwitchBtn(mobileView === "list")}
          >
            List
          </button>
          <button
            type="button"
            aria-pressed={mobileView === "map"}
            onClick={() => setMobileView("map")}
            style={viewSwitchBtn(mobileView === "map")}
          >
            Map
          </button>
        </div>
      </div>

      {/* main split: list (canonical) + map */}
      <div style={{ display: "flex", flex: "1 1 auto", minHeight: 0 }}>
        <div
          className={`${mobileView === "list" ? "flex" : "hidden"} lg:flex flex-col min-h-0 w-full lg:w-[420px] lg:flex-none`}
          style={{ borderRight: "1px solid var(--line)", background: "var(--bg)" }}
        >
          <div style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto" }}>
            {results.length > 0 ? (
              <StationList stations={results} selectedId={selectedId} onSelect={handleSelect} />
            ) : (
              <div style={{ padding: "40px 22px", textAlign: "center", color: "var(--ink-3)" }}>
                <h3 style={{ margin: "0 0 6px", fontSize: 15, color: "var(--ink-2)" }}>
                  No stations match these filters
                </h3>
                <p style={{ margin: "0 0 14px", fontSize: 13, lineHeight: 1.5 }}>
                  No premium-grade outlet fits here yet — widen your grades or brands, or search a
                  covered city.
                </p>
                {emptyCities.length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      flexWrap: "wrap",
                      justifyContent: "center",
                      marginBottom: 14,
                    }}
                  >
                    {emptyCities.map((city) => (
                      <button
                        key={city}
                        type="button"
                        onClick={() => setFilter((f) => ({ ...f, query: city }))}
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          border: "1px solid var(--line)",
                          background: "var(--surface)",
                          color: "var(--accent-ink)",
                          borderRadius: 999,
                          padding: "5px 11px",
                          cursor: "pointer",
                        }}
                      >
                        {city}
                      </button>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setFilter(buildInitialFilter(origins))}
                  style={{
                    fontSize: 12.5,
                    fontWeight: 700,
                    border: "1px solid var(--line)",
                    background: "var(--surface)",
                    color: "var(--ink-2)",
                    borderRadius: 9,
                    padding: "8px 14px",
                    cursor: "pointer",
                  }}
                >
                  Reset filters
                </button>
              </div>
            )}
          </div>
        </div>

        <div
          className={`${mobileView === "map" ? "block" : "hidden"} lg:block relative w-full lg:flex-1 min-h-0`}
          style={{ background: "var(--map-ocean, var(--surface-2))" }}
        >
          <MapLibreMap
            stations={results}
            selectedId={selectedId}
            onSelectStation={handleSelect}
            styleUrl={styleUrl}
          />
        </div>
      </div>

      {/* detail overlay (drawer + scrim) */}
      {selectedStation && (
        <>
          <div
            aria-hidden="true"
            onClick={handleClose}
            style={{ position: "fixed", inset: 0, background: "rgba(6,12,13,.42)", zIndex: 39 }}
          />
          <aside
            ref={detailRef}
            tabIndex={-1}
            aria-label={`Detail for ${selectedStation.name}`}
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              height: "100%",
              width: "min(420px, 100vw)",
              zIndex: 40,
              background: "var(--surface)",
              borderLeft: "1px solid var(--line)",
              boxShadow: "var(--shadow-lg)",
              outline: "none",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <StationDetail station={selectedStation} onClose={handleClose} />
          </aside>
        </>
      )}
    </div>
  );
}
