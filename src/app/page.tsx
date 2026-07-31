// Homepage = the map (Google-Maps style). Full-screen pins for every known
// 100-octane pump, one search box, and an "Add a pump" button. Server component:
// loads the dataset through the data layer (seed fallback — no DB needed) and
// hands plain data to the SimpleMapHome client component.

import type { Metadata } from "next";

import SimpleMapHome from "@/components/SimpleMapHome";
import { allStations } from "@/lib/data";
import { publicEnv } from "@/lib/env";
import { SITE_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: {
    absolute: `${SITE_NAME} — XP100, poWer 100 & Speed 100 petrol pump map of India`,
  },
  description:
    "Map of petrol pumps selling ethanol-free (E0) 100-octane petrol in India — IndianOil XP100, HP poWer 100 and Bharat Petroleum Speed 100. Find one near you, or add a pump you found.",
  alternates: { canonical: "/" },
};

export default function HomePage() {
  return (
    <main id="main">
      <h1 className="sr-only">
        OctaneFinder — map of XP100, poWer 100 and Speed 100 petrol pumps in India
      </h1>
      <SimpleMapHome stations={allStations()} styleUrl={publicEnv.mapStyleUrl} />
    </main>
  );
}
