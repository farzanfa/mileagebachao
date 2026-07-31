// Station list (BUILD-CONTRACT §8). The canonical, screen-reader-accessible surface —
// everything on the map is reachable here (UX §4.5.3). Renders a plain <ul> of
// StationCards; layout/scroll and the nearest-alternative fallback are the parent's
// job (AppShell never passes a bare empty list in practice). Dual-use: works in the
// client app and in server-rendered SEO pages (StationCard picks link vs button).

import type { Station, StationWithDistance } from "@/lib/types";
import StationCard from "@/components/StationCard";

export function StationList({
  stations,
  selectedId,
  onSelect,
}: {
  stations: (Station | StationWithDistance)[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}) {
  if (stations.length === 0) {
    return (
      <div className="px-[22px] py-10 text-center text-[var(--ink-3)]" role="status">
        <svg
          className="mx-auto mb-3 h-[34px] w-[34px] opacity-50"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          aria-hidden
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.2-3.2" strokeLinecap="round" />
        </svg>
        <h3 className="m-0 mb-[6px] text-[15px] text-[var(--ink-2)]">
          No stations match these filters
        </h3>
        <p className="m-0 text-[13px]">
          No premium-grade outlet fits here yet. Try widening your filters, clearing
          &ldquo;ethanol-free only&rdquo;, or searching another city.
        </p>
      </div>
    );
  }

  return (
    <ul className="m-0 flex list-none flex-col gap-2 p-2">
      {stations.map((s) => (
        <li key={s.id}>
          <StationCard station={s} selected={selectedId === s.id} onSelect={onSelect} />
        </li>
      ))}
    </ul>
  );
}

export default StationList;
