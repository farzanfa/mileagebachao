// Site header (BUILD-CONTRACT §8 `Header({})`). Shared/server component: brand mark
// + wordmark, primary nav, an "Open map" CTA and the client ThemeToggle island.
// Positioning leads with ethanol-free (E0); the wordmark and tagline come from
// src/lib/constants. A skip link is the first focusable element (WCAG 2.4.1).
//
// Cross-slice assumption: pages render their main region as <main id="main"> so the
// skip link has a target (PAGES / MAPAPP slices).

import Link from "next/link";

import { SITE_NAME, SITE_TAGLINE } from "@/lib/constants";
import BrandMark from "@/components/BrandMark";
import Button from "@/components/ui/Button";

const NAV_LINK =
  "px-3 py-2 rounded-[8px] text-[13px] font-[650] text-[var(--ink-2)] no-underline transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--ink)]";

export function Header() {
  return (
    <header className="sticky top-0 z-30 flex flex-wrap items-center gap-4 border-b border-[var(--line)] bg-[var(--surface)] px-[18px] py-3">
      <a
        href="#main"
        className="sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:left-3 focus-visible:top-3 focus-visible:z-50 focus-visible:rounded-[8px] focus-visible:border focus-visible:border-[var(--line)] focus-visible:bg-[var(--surface)] focus-visible:px-3 focus-visible:py-2 focus-visible:text-[13px] focus-visible:font-bold focus-visible:text-[var(--ink)]"
      >
        Skip to content
      </a>

      <Link href="/" className="mr-auto flex items-center gap-[11px] no-underline" aria-label={`${SITE_NAME} home`}>
        <BrandMark size={34} />
        <span className="flex flex-col leading-[1.05]">
          <span className="text-[16.5px] font-extrabold tracking-[-0.3px] text-[var(--ink)]">
            Mileage<span className="text-[var(--accent)]">Bachao</span>
          </span>
          <span className="mt-[2px] hidden text-[11px] text-[var(--ink-3)] sm:block">
            {SITE_TAGLINE}
          </span>
        </span>
      </Link>

      <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
        <Link href="/about" className={NAV_LINK}>
          About
        </Link>
      </nav>

      <div className="flex items-center gap-2">
        <Button href="/" variant="primary" size="sm">
          Open map
        </Button>
      </div>
    </header>
  );
}

export default Header;
