// Freshness / verification badge for a single grade (BUILD-CONTRACT §8, UX §4.3).
// Pure function of the StationGrade record — no client-side freshness inference; it
// renders whatever gradeFreshness() classifies. The "unverified" case is the honest
// launch state: a dashed slate pill reading "Unverified — official listing, not
// field-confirmed" (memo §0). All other states render a tinted availability pill.
// Meaning is carried by the label text + dot, never by colour alone (WCAG 1.4.1).

import type { StationGrade } from "@/lib/types";
import { gradeFreshness } from "@/lib/freshness";

export function FreshnessBadge({ grade }: { grade: StationGrade }) {
  const info = gradeFreshness(grade);

  if (info.key === "unverified") {
    return (
      <span
        className="inline-flex items-center gap-[5px] self-start rounded-[6px] px-[7px] py-[2px] text-[10.5px] font-[750] tracking-[0.02em]"
        style={{ color: "var(--unknown)", border: "1px dashed var(--unknown)" }}
      >
        <span
          aria-hidden
          className="h-[7px] w-[7px] rounded-full"
          style={{ background: "var(--unknown)" }}
        />
        Unverified — official listing, not field-confirmed
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-[6px] rounded-full px-[9px] py-[4px] text-[11.5px] font-[750]"
      style={{
        background: `color-mix(in srgb, var(${info.colorVar}) 16%, transparent)`,
        color: `var(${info.colorVar})`,
      }}
    >
      <span
        aria-hidden
        className="h-2 w-2 rounded-full"
        style={{ background: `var(${info.colorVar})` }}
      />
      {info.label}
    </span>
  );
}

export default FreshnessBadge;
