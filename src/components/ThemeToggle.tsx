// Light/dark theme toggle (BUILD-CONTRACT §8 `ThemeToggle()`, §9).
// Persists the choice in localStorage("theme") and stamps
// document.documentElement.dataset.theme so the explicit choice beats the OS
// preference in both directions (tokens.css keys off [data-theme]). The pre-paint
// inline script in app/layout.tsx reads the same key, so there is no theme flash.

"use client";

import { useEffect, useState } from "react";

type Mode = "light" | "dark";

function systemPrefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

const ICON = "h-[18px] w-[18px]";

function SunIcon() {
  return (
    <svg className={ICON} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg className={ICON} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z" />
    </svg>
  );
}

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<Mode>("light");

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem("theme");
    } catch {
      stored = null;
    }
    const resolved: Mode =
      stored === "dark" || stored === "light" ? stored : systemPrefersDark() ? "dark" : "light";
    setMode(resolved);
    setMounted(true);
  }, []);

  function toggle() {
    const next: Mode = mode === "dark" ? "light" : "dark";
    setMode(next);
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* storage may be unavailable (private mode); the in-memory toggle still works */
    }
    document.documentElement.dataset.theme = next;
  }

  const isDark = mode === "dark";
  const label = !mounted
    ? "Toggle light or dark theme"
    : isDark
      ? "Switch to light theme"
      : "Switch to dark theme";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className="inline-grid h-11 w-11 place-items-center rounded-[10px] border border-[var(--line)] bg-[var(--surface-2)] text-[var(--ink-2)] transition-colors hover:border-[var(--line-strong)] hover:text-[var(--ink)]"
    >
      {mounted && isDark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

export default ThemeToggle;
