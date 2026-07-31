"use client";

// Interactive MapLibre GL map (BUILD-CONTRACT §8, §2.5; design §4.2.2 / §4.3).
// - maplibre-gl is DYNAMICALLY imported inside an effect so it never touches the
//   server render (contract §2.5: client-only libs live in "use client" components).
// - Stations render as brand-colored teardrop markers with a white grade-badge
//   roundel (RON numeral) and a freshness "core" dot — never color-only (WCAG).
// - Cluster-friendly: at low zoom, overlapping pins collapse into count bubbles
//   that expand (fitBounds) on click. Individual markers track their lng/lat as the
//   map moves; clusters recompute on `moveend`.
// - Empty `styleUrl` (NEXT_PUBLIC_MAP_STYLE_URL unset) renders an accessible
//   "configure map" panel instead of crashing — the list stays fully usable.

import { useCallback, useEffect, useRef, useState } from "react";
import type { Map as MaplibreMap, Marker as MaplibreMarker, StyleSpecification } from "maplibre-gl";

import type { Brand, GradeName, Station } from "@/lib/types";
import { bestFreshness } from "@/lib/freshness";

// maplibre-gl ships its control styling as a plain stylesheet; importing it inside
// this "use client" module keeps the dependency off the server graph.
import "maplibre-gl/dist/maplibre-gl.css";

// Fixed domain facts (contract §0/§5) — kept local so the map component never has
// to import the (larger) data layer just to color a pin.
const BRAND_COLOR_VAR: Record<Brand, string> = {
  IOCL: "--brand-iocl",
  HPCL: "--brand-hpcl",
  BPCL: "--brand-bpcl",
};
const GRADE_RON: Record<GradeName, number> = {
  XP100: 100,
  "poWer 100": 100,
  "Speed 100": 100,
  "poWer 99": 99,
  "Speed 97": 97,
};

// Zoom below which markers collapse into clusters (design §4.3: clustering only
// matters at low zoom with ~300 stations nationwide).
const CLUSTER_MAX_ZOOM = 7;
const CLUSTER_CELL_PX = 64;

// India-wide default camera.
const INDIA_CENTER: [number, number] = [80.9, 22.5];
const INDIA_ZOOM = 3.6;

// Zero-config fallback basemap: OpenStreetMap raster tiles. Renders a familiar
// Google-Maps-like map with no API key. Fine for development and small deployments;
// switch NEXT_PUBLIC_MAP_STYLE_URL to a commercial style (Stadia/MapTiler) for
// production scale, per the OSM tile usage policy.
const OSM_RASTER_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      maxzoom: 19,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

export interface MapLibreMapProps {
  stations: Station[];
  selectedId?: string | null;
  onSelectStation?: (id: string) => void;
  styleUrl?: string;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Highest RON among a station's grades — the numeral shown in the pin badge. */
function badgeRon(s: Station): number {
  let ron = 0;
  for (const g of s.grades) {
    const r = GRADE_RON[g.grade];
    if (r > ron) ron = r;
  }
  return ron || 100;
}

function buildPinElement(s: Station, selected: boolean): HTMLButtonElement {
  const brandVar = BRAND_COLOR_VAR[s.brand];
  const freshVar = bestFreshness(s).colorVar;
  const ron = badgeRon(s);
  const w = selected ? 42 : 34;
  const h = selected ? 49 : 40;

  const el = document.createElement("button");
  el.type = "button";
  el.setAttribute("aria-label", `${s.name}, ${s.city}. RON ${ron}. Open details.`);
  el.style.cssText = [
    "appearance:none",
    "background:transparent",
    "border:0",
    "padding:0",
    "margin:0",
    "cursor:pointer",
    "display:block",
    "line-height:0",
    `width:${w}px`,
    `height:${h}px`,
    selected ? "z-index:3" : "z-index:1",
  ].join(";");

  const ring = selected
    ? '<circle cx="0" cy="-24" r="15" fill="none" stroke="var(--accent)" stroke-width="2.5"/>'
    : "";

  el.innerHTML =
    '<svg width="100%" height="100%" viewBox="-17 -40 34 40" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">' +
    // teardrop body (brand colored) with a surface-colored halo stroke for >=3:1 non-text contrast on any tile
    '<path d="M0 0 C -9 -13 -11 -18 -11 -23 A 11 11 0 1 1 11 -23 C 11 -18 9 -13 0 0 Z" ' +
    `fill="var(${brandVar})" stroke="var(--surface)" stroke-width="2"/>` +
    // white grade-badge roundel + RON numeral (color-blind safe: numeral, not color)
    '<circle cx="0" cy="-24" r="8.5" fill="#ffffff"/>' +
    `<text x="0" y="-24" text-anchor="middle" dominant-baseline="central" font-family="var(--font-mono, monospace)" font-size="8.5" font-weight="700" fill="#101819">${ron}</text>` +
    // freshness core dot, top-right, with surface stroke
    `<circle cx="9" cy="-33" r="5" fill="var(${freshVar})" stroke="var(--surface)" stroke-width="1.4"/>` +
    ring +
    "</svg>";

  return el;
}

function buildClusterElement(count: number): HTMLButtonElement {
  const size = count >= 25 ? 48 : count >= 10 ? 42 : 36;
  const el = document.createElement("button");
  el.type = "button";
  el.setAttribute("aria-label", `${count} stations here. Zoom in to expand.`);
  el.style.cssText = [
    "appearance:none",
    "cursor:pointer",
    `width:${size}px`,
    `height:${size}px`,
    "border-radius:999px",
    "background:var(--surface)",
    "color:var(--ink)",
    "border:1px solid var(--line-strong)",
    "box-shadow:0 1px 2px rgba(16,24,25,.18), 0 4px 12px rgba(16,24,25,.14)",
    "font-family:var(--font-sans, sans-serif)",
    "font-weight:700",
    `font-size:${size >= 44 ? 15 : 13}px`,
    "display:flex",
    "align-items:center",
    "justify-content:center",
  ].join(";");
  el.textContent = String(count);
  return el;
}

export default function MapLibreMap({
  stations,
  selectedId = null,
  onSelectStation,
  styleUrl,
}: MapLibreMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const mlRef = useRef<typeof import("maplibre-gl") | null>(null);
  const markersRef = useRef<MaplibreMarker[]>([]);
  const renderRef = useRef<() => void>(() => {});
  const fittedKeyRef = useRef<string>("");

  const [ready, setReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  const resolvedStyle = styleUrl ?? "";

  // ---- (re)build all markers from the current props (read via the render ref on moveend) ----
  const renderMarkers = useCallback(() => {
    const map = mapRef.current;
    const maplibregl = mlRef.current;
    if (!map || !maplibregl) return;

    for (const m of markersRef.current) m.remove();
    markersRef.current = [];

    const selected =
      selectedId != null ? stations.find((s) => s.id === selectedId) ?? null : null;

    const addPin = (s: Station, isSelected: boolean) => {
      const el = buildPinElement(s, isSelected);
      el.addEventListener("click", (ev) => {
        ev.stopPropagation();
        onSelectStation?.(s.id);
      });
      const marker = new maplibregl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([s.lng, s.lat])
        .addTo(map);
      markersRef.current.push(marker);
    };

    const doCluster = map.getZoom() < CLUSTER_MAX_ZOOM && stations.length > 1;

    if (!doCluster) {
      for (const s of stations) {
        if (selected && s.id === selected.id) continue;
        addPin(s, false);
      }
    } else {
      const buckets = new Map<string, Station[]>();
      for (const s of stations) {
        if (selected && s.id === selected.id) continue;
        const pt = map.project([s.lng, s.lat]);
        const key = `${Math.floor(pt.x / CLUSTER_CELL_PX)}:${Math.floor(pt.y / CLUSTER_CELL_PX)}`;
        const arr = buckets.get(key);
        if (arr) arr.push(s);
        else buckets.set(key, [s]);
      }
      for (const group of buckets.values()) {
        if (group.length === 1) {
          const only = group[0];
          if (only) addPin(only, false);
          continue;
        }
        let lng = 0;
        let lat = 0;
        for (const s of group) {
          lng += s.lng;
          lat += s.lat;
        }
        lng /= group.length;
        lat /= group.length;

        const el = buildClusterElement(group.length);
        el.addEventListener("click", (ev) => {
          ev.stopPropagation();
          const b = new maplibregl.LngLatBounds();
          for (const s of group) b.extend([s.lng, s.lat]);
          map.fitBounds(b, {
            padding: 80,
            maxZoom: 13,
            duration: prefersReducedMotion() ? 0 : 400,
          });
        });
        const marker = new maplibregl.Marker({ element: el, anchor: "center" })
          .setLngLat([lng, lat])
          .addTo(map);
        markersRef.current.push(marker);
      }
    }

    // selected pin is added last so it renders on top of its neighbours
    if (selected) addPin(selected, true);
  }, [stations, selectedId, onSelectStation]);

  // Keep the latest renderer available to the (once-attached) moveend listener.
  useEffect(() => {
    renderRef.current = renderMarkers;
  }, [renderMarkers]);

  // ---- initialise the map (custom style URL, or the zero-config OSM fallback) ----
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;

    (async () => {
      try {
        const imported = await import("maplibre-gl");
        // Interop: the package exposes named exports; under some bundler configs the
        // namespace is nested under `default`. Handle both, staying type-safe.
        const maplibregl =
          (imported as unknown as { default?: typeof imported }).default ?? imported;
        if (cancelled) return;

        mlRef.current = maplibregl;
        const map = new maplibregl.Map({
          container,
          style: resolvedStyle || OSM_RASTER_STYLE,
          center: INDIA_CENTER,
          zoom: INDIA_ZOOM,
          attributionControl: false,
        });
        mapRef.current = map;

        const attribution =
          process.env.NEXT_PUBLIC_MAP_ATTRIBUTION || "© OpenStreetMap contributors";
        map.addControl(
          new maplibregl.AttributionControl({ compact: true, customAttribution: attribution }),
          "bottom-right",
        );
        map.addControl(
          new maplibregl.NavigationControl({ showCompass: true, visualizePitch: false }),
          "top-right",
        );

        map.on("load", () => {
          if (!cancelled) setReady(true);
        });
        // Recompute clusters after any pan/zoom settles.
        map.on("moveend", () => {
          renderRef.current();
        });
        // Keep the app alive if tiles/style fail to load — the list is canonical.
        map.on("error", () => {});
      } catch {
        if (!cancelled) setInitError("The map could not be loaded. The station list remains fully usable.");
      }
    })();

    return () => {
      cancelled = true;
      for (const m of markersRef.current) m.remove();
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
      mlRef.current = null;
      setReady(false);
    };
  }, [resolvedStyle]);

  // ---- render markers on data / selection changes ----
  useEffect(() => {
    if (ready) renderMarkers();
  }, [ready, renderMarkers]);

  // ---- fit bounds when the visible station set changes ----
  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    const maplibregl = mlRef.current;
    if (!map || !maplibregl) return;

    const key = stations
      .map((s) => s.id)
      .slice()
      .sort()
      .join(",");
    if (key === fittedKeyRef.current) return;
    fittedKeyRef.current = key;
    if (stations.length === 0) return;

    const reduce = prefersReducedMotion();
    if (stations.length === 1) {
      const only = stations[0];
      if (!only) return;
      if (reduce) map.jumpTo({ center: [only.lng, only.lat], zoom: 11 });
      else map.easeTo({ center: [only.lng, only.lat], zoom: 11, duration: 400 });
      return;
    }

    const b = new maplibregl.LngLatBounds();
    for (const s of stations) b.extend([s.lng, s.lat]);
    map.fitBounds(b, { padding: 64, maxZoom: 12, duration: reduce ? 0 : 400 });
  }, [ready, stations]);

  // ---- gently reveal the selected station if it is off-screen ----
  useEffect(() => {
    if (!ready || selectedId == null) return;
    const map = mapRef.current;
    if (!map) return;
    const s = stations.find((st) => st.id === selectedId);
    if (!s) return;
    if (map.getBounds().contains([s.lng, s.lat])) return;
    const reduce = prefersReducedMotion();
    if (reduce) map.jumpTo({ center: [s.lng, s.lat] });
    else map.easeTo({ center: [s.lng, s.lat], duration: 400 });
  }, [ready, selectedId, stations]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div
        ref={containerRef}
        role="region"
        aria-label="Map of premium-fuel stations. This is a supplemental visualization — the station list provides full keyboard and screen-reader access to every station."
        style={{ position: "absolute", inset: 0 }}
      />

      {initError && (
        <div
          role="alert"
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            right: 12,
            zIndex: 6,
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: 10,
            padding: "8px 12px",
            fontSize: 12.5,
            color: "var(--ink-2)",
            boxShadow: "var(--shadow)",
          }}
        >
          {initError}
        </div>
      )}

      {/* Legend (design §4.3) — brands + freshness, always paired with text */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: 12,
          bottom: 12,
          zIndex: 6,
          maxWidth: 210,
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: 10,
          padding: "10px 12px",
          boxShadow: "var(--shadow)",
          fontSize: 11.5,
          color: "var(--ink-2)",
          lineHeight: 1.35,
        }}
      >
        <div
          style={{
            fontSize: 10,
            letterSpacing: ".09em",
            textTransform: "uppercase",
            color: "var(--ink-3)",
            fontWeight: 700,
            marginBottom: 6,
          }}
        >
          Legend
        </div>
        {(
          [
            ["--brand-iocl", "IndianOil"],
            ["--brand-hpcl", "HPCL"],
            ["--brand-bpcl", "BPCL"],
          ] as const
        ).map(([v, label]) => (
          <div key={v} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3 }}>
            <span
              style={{
                width: 11,
                height: 11,
                borderRadius: 3,
                flex: "none",
                background: `var(${v})`,
              }}
            />
            {label}
          </div>
        ))}
        <div
          style={{
            height: 1,
            background: "var(--line)",
            margin: "8px 0",
          }}
        />
        {(
          [
            ["--fresh", "In stock · verified"],
            ["--stale", "Stale · needs a check-in"],
            ["--unknown", "Unverified listing"],
            ["--dry", "Reported dry"],
          ] as const
        ).map(([v, label]) => (
          <div key={v} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                flex: "none",
                background: `var(${v})`,
                boxShadow: "0 0 0 1px var(--line-strong)",
              }}
            />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}
