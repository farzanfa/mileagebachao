// Generic switch / toggle (BUILD-CONTRACT §8 "ui/Switch generic").
// A labelled, keyboard-operable checkbox styled as a sliding switch. Ported from the
// prototype `.switch` / `.toggle-row` rules. When `label` is given it renders the full
// labelled row; otherwise just the control (an aria-label is then required for a11y).
// The hidden input's hit area is extended to a 44px touch target (WCAG 2.5.8).

"use client";

import { useId } from "react";

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  id?: string;
  "aria-label"?: string;
}

export function Switch(props: SwitchProps) {
  const { checked, onChange, label, description, disabled = false, id } = props;
  const ariaLabel = props["aria-label"];
  const auto = useId();
  const inputId = id ?? auto;

  const control = (
    <span className="relative inline-block h-[26px] w-[44px] shrink-0">
      <input
        id={inputId}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={label ? undefined : ariaLabel}
        className="peer absolute inset-x-0 bottom-[-9px] top-[-9px] m-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full bg-[var(--line-strong)] transition-colors peer-checked:bg-[var(--accent)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--accent)] peer-disabled:opacity-50"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute left-[3px] top-[3px] h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-[18px]"
      />
    </span>
  );

  if (!label) {
    return control;
  }

  return (
    <label
      htmlFor={inputId}
      className="flex cursor-pointer items-center justify-between gap-[10px] rounded-[10px] border border-[var(--line)] bg-[var(--surface-2)] p-3"
    >
      <span className="min-w-0">
        <span className="block text-[13px] font-bold text-[var(--ink)]">{label}</span>
        {description ? (
          <span className="mt-[2px] block text-[11.5px] text-[var(--ink-3)]">{description}</span>
        ) : null}
      </span>
      {control}
    </label>
  );
}

export default Switch;
