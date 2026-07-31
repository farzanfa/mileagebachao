// Grade tag (BUILD-CONTRACT §8). A compact tag showing the grade name and its RON
// numeral, with an optional freshness dot. The RON numeral is always present so grade
// is never encoded by colour alone (UX §4.2.2, colour-blind safe by construction).
// Ported from the prototype `.gtag` rule. Freshness key -> colour token mirrors
// src/lib/freshness.ts so the two stay in lock-step.

import type { FreshnessKey, GradeName } from "@/lib/types";

const RON: Record<GradeName, number> = {
  XP100: 100,
  "poWer 100": 100,
  "Speed 100": 100,
  "poWer 99": 99,
  "Speed 97": 97,
};

// Matches gradeFreshness() colorVar assignments in src/lib/freshness.ts.
const KEY_COLOR: Record<FreshnessKey, string> = {
  fresh: "--fresh",
  likely: "--stale",
  stale: "--stale",
  dry: "--dry",
  unverified: "--unknown",
};

export function GradeTag({ grade, freshness }: { grade: GradeName; freshness?: FreshnessKey }) {
  return (
    <span className="inline-flex items-center gap-[6px] rounded-[7px] border border-[var(--line)] bg-[var(--surface-2)] px-2 py-1 text-[11.5px] font-bold text-[var(--ink)]">
      {freshness ? (
        <span
          aria-hidden
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ background: `var(${KEY_COLOR[freshness]})` }}
        />
      ) : null}
      <span>{grade}</span>
      <span className="mono text-[10px] font-bold text-[var(--ink-3)]">{RON[grade]}</span>
    </span>
  );
}

export default GradeTag;
