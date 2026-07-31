// Generic toggle chip (BUILD-CONTRACT §8 "ui/Chip generic").
// A pill-shaped toggle button carrying aria-pressed, an optional brand/grade colour
// dot and an optional RON numeral. Selection state is never colour-only: the label
// text and the aria-pressed value always carry the meaning. Ported visually from the
// prototype `.chip` rules. Shared component (renders inside client Filters).

import type { ReactNode } from "react";

export interface ChipProps {
  children: ReactNode;
  pressed?: boolean;
  onToggle?: () => void;
  /** CSS custom-property name for the leading dot, e.g. "--brand-iocl". */
  dotColorVar?: string;
  /** RON numeral shown in a monospace tail, e.g. 100. */
  ron?: number;
  legacy?: boolean;
  disabled?: boolean;
  /** Visually de-emphasise while remaining operable (e.g. E0-only hides legacy). */
  dimmed?: boolean;
  className?: string;
  "aria-label"?: string;
}

const BASE =
  "group inline-flex items-center gap-[7px] rounded-full border px-3 min-h-[44px] " +
  "text-[12.5px] font-[650] transition-colors disabled:cursor-not-allowed";

export function Chip(props: ChipProps) {
  const {
    children,
    pressed = false,
    onToggle,
    dotColorVar,
    ron,
    legacy = false,
    disabled = false,
    dimmed = false,
    className,
  } = props;
  const ariaLabel = props["aria-label"];

  const state = pressed
    ? "bg-[var(--accent-soft)] text-[var(--accent-ink)] border-[var(--accent)]"
    : "bg-[var(--surface)] text-[var(--ink-2)] border-[var(--line)] hover:border-[var(--line-strong)]";

  const cls = [BASE, state, legacy ? "border-dashed" : "", className].filter(Boolean).join(" ");

  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onToggle}
      className={cls}
      style={dimmed ? { opacity: 0.45 } : undefined}
    >
      {dotColorVar ? (
        <span
          aria-hidden
          className="h-[9px] w-[9px] shrink-0 rounded-full"
          style={{ background: `var(${dotColorVar})` }}
        />
      ) : null}
      <span>{children}</span>
      {ron !== undefined ? (
        <span
          className={
            "mono text-[11px] font-bold " +
            (pressed ? "text-[var(--accent-ink)]" : "text-[var(--ink-3)]")
          }
        >
          {ron}
        </span>
      ) : null}
    </button>
  );
}

export default Chip;
