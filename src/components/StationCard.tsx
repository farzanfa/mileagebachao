// Station list card (BUILD-CONTRACT §8). Ported from the prototype `.card`.
// Dual-use, so it works in both the interactive app and crawlable SEO pages:
//   - with `onSelect` -> a <button> that selects the station (map/list app view)
//   - without         -> an <a href="/station/{slug}"> so server pages stay crawlable
// Shows brand chip, cleaned locality name, city/pincode, per-grade GradeTags with
// freshness dots, an authoritative price (only when present), and the station-level
// "Unverified" badge when nothing has been field-verified.

import type { Station, StationWithDistance } from "@/lib/types";
import { gradeFreshness, stationIsAllUnverified } from "@/lib/freshness";
import BrandChip from "@/components/BrandChip";
import GradeTag from "@/components/GradeTag";
import FreshnessBadge from "@/components/FreshnessBadge";

/** Strip a leading "IndianOil, " / "BPCL Fuel Station, " prefix to the locality. */
function cleanName(name: string): string {
  return name.replace(/^[^,]+,\s*/, "");
}

function fmtDist(km: number): string {
  return km < 10 ? km.toFixed(1) : Math.round(km).toString();
}

const CARD_BASE =
  "group flex w-full flex-col gap-[9px] rounded-[12px] border bg-[var(--surface)] p-[13px] text-left no-underline transition-colors";

export function StationCard({
  station,
  distanceKm,
  selected = false,
  onSelect,
}: {
  station: Station;
  distanceKm?: number;
  selected?: boolean;
  onSelect?: (id: string) => void;
}) {
  const dist =
    distanceKm ??
    ("distanceKm" in station ? (station as StationWithDistance).distanceKm : undefined);
  const allUnverified = stationIsAllUnverified(station);
  const firstGrade = station.grades[0];
  const label = `Open ${cleanName(station.name)} details`;

  const cls = [
    CARD_BASE,
    selected
      ? "border-[var(--accent)] [box-shadow:0_0_0_1px_var(--accent)]"
      : "border-[var(--line)] hover:border-[var(--line-strong)] hover:shadow-token",
  ].join(" ");

  const inner = (
    <>
      <div className="flex items-start gap-[10px]">
        <div className="min-w-0">
          <BrandChip brand={station.brand} />
          <h3 className="m-0 mt-1 text-[14.5px] font-[750] leading-[1.2] tracking-[-0.2px] text-[var(--ink)]">
            {cleanName(station.name)}
          </h3>
          <div className="mt-[2px] text-[12px] text-[var(--ink-3)]">
            {station.city} · {station.pincode}
          </div>
        </div>
        {dist !== undefined ? (
          <div className="tnum ml-auto shrink-0 text-right text-[12px] font-bold text-[var(--ink-2)]">
            {fmtDist(dist)} km
            <small className="block text-[10.5px] font-medium text-[var(--ink-3)]">aerial</small>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-[6px]">
        {station.grades.map((g) => (
          <GradeTag key={g.grade} grade={g.grade} freshness={gradeFreshness(g).key} />
        ))}
      </div>

      {station.price ? (
        <div className="tnum flex flex-wrap items-baseline gap-2 text-[12px] text-[var(--ink-2)]">
          <span className="font-bold">₹{station.price.value}/L</span>
          <span className="text-[var(--ink-3)]">{station.price.source}</span>
        </div>
      ) : null}

      {allUnverified && firstGrade ? <FreshnessBadge grade={firstGrade} /> : null}
    </>
  );

  if (onSelect) {
    return (
      <button
        type="button"
        onClick={() => onSelect(station.id)}
        aria-pressed={selected}
        aria-label={label}
        data-station-id={station.id}
        className={cls}
        style={{ scrollMarginTop: "72px" }}
      >
        {inner}
      </button>
    );
  }

  return (
    <a
      href={`/station/${station.slug}`}
      aria-label={label}
      data-station-id={station.id}
      className={cls}
      style={{ scrollMarginTop: "72px" }}
    >
      {inner}
    </a>
  );
}

export default StationCard;
