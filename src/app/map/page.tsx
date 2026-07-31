// Interactive app view (BUILD-CONTRACT §8; design §4.5.3).
// Server component: loads the read-only seed dataset through the data layer (never the
// DB, never self-fetching HTTP) and hands plain, serializable data to <AppShell> (client).
// Builds and renders with no database and no secrets (contract §2): allStations() falls
// back to the committed seed JSON, and the map degrades to a "configure map" panel when
// NEXT_PUBLIC_MAP_STYLE_URL is unset.

import type { Metadata } from "next";

import { allStations, brandMeta, gradeMeta, origins } from "@/lib/data";
import AppShell from "@/components/AppShell";
import Header from "@/components/Header";

export const metadata: Metadata = {
  title: "Map",
  description:
    "Search and map petrol pumps stocking ethanol-free (E0), 100-octane premium fuel across India — XP100, poWer 100 and Speed 100 — filtered by grade, brand and distance.",
  alternates: { canonical: "/map" },
};

export default function MapPage() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100dvh",
        overflow: "hidden",
      }}
    >
      <Header />
      <AppShell
        initialStations={allStations()}
        gradeMeta={gradeMeta()}
        brandMeta={brandMeta()}
        origins={origins()}
      />
    </div>
  );
}
