// Landing page `/` (BUILD-CONTRACT §11 PAGES, §8; UI/UX §4.5.1).
// Server-rendered, no map library. E0-first hero, live counts from @/lib/data,
// links to /map and the data-driven top cities, plus SEO metadata and JSON-LD.

import type { Metadata } from "next";
import Link from "next/link";

import { Header } from "@/components/Header";
import { allStations, brandMeta, cities, gradeMeta } from "@/lib/data";
import { publicEnv } from "@/lib/env";
import {
  ALL_GRADES,
  LEGACY_GRADES,
  PRIMARY_GRADES,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TAGLINE,
} from "@/lib/constants";
import type { GradeName } from "@/lib/types";

const SITE_URL = publicEnv.siteUrl.replace(/\/+$/, "");

export const metadata: Metadata = {
  title: {
    absolute: `${SITE_NAME} — Ethanol-free (E0) & 100-octane petrol finder for India`,
  },
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
  },
};

const MAX_CITY_CHIPS = 12;

export default function LandingPage() {
  const stations = allStations();
  const gm = gradeMeta();
  const bm = brandMeta();
  const cityList = cities();

  const stationCount = stations.length;
  const cityCount = cityList.length;

  const gradeCount = (g: GradeName): number =>
    stations.filter((s) => s.grades.some((x) => x.grade === g)).length;

  const topCities = cityList.slice(0, MAX_CITY_CHIPS);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: `${SITE_URL}/`,
        name: SITE_NAME,
        description: SITE_DESCRIPTION,
        inLanguage: "en-IN",
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${SITE_URL}/map?q={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        },
      },
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#org`,
        name: SITE_NAME,
        url: `${SITE_URL}/`,
        description:
          "Independent, all-OMC aggregator of ethanol-free (E0), 100-octane petrol outlets in India.",
      },
    ],
  };

  return (
    <>
      <Header />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main id="main">
        {/* ---------- Hero ---------- */}
        <section
          className="mx-auto w-full max-w-5xl px-4 pb-8 pt-12 sm:pt-16"
          aria-labelledby="hero-heading"
        >
          <p
            className="mb-3 text-sm font-semibold uppercase tracking-wide"
            style={{ color: "var(--accent-ink)" }}
          >
            Ethanol-free (E0) petrol · 100 RON
          </p>
          <h1
            id="hero-heading"
            className="text-3xl font-bold leading-tight sm:text-4xl md:text-5xl"
            style={{ color: "var(--ink)" }}
          >
            Find genuine ethanol-free (E0), 100-octane petrol in India
          </h1>
          <p className="mt-4 max-w-2xl text-lg" style={{ color: "var(--ink-2)" }}>
            The pan-India, all-OMC map of{" "}
            <span style={{ color: "var(--ink)" }}>IndianOil XP100</span>,{" "}
            <span style={{ color: "var(--ink)" }}>HPCL poWer 100</span> and{" "}
            <span style={{ color: "var(--ink)" }}>BPCL Speed 100</span> — the only three grades still
            supplied with zero ethanol. Every listing is sourced, dated and freshness-scored.
          </p>

          {/* Search posts to /map so the hero works without JavaScript. */}
          <form
            action="/map"
            method="get"
            role="search"
            aria-label="Search for ethanol-free petrol stations"
            className="mt-6 flex flex-col gap-3 sm:flex-row"
          >
            <label htmlFor="hero-q" className="sr-only">
              Search by city, PIN code or station name
            </label>
            <input
              id="hero-q"
              name="q"
              type="search"
              inputMode="search"
              autoComplete="off"
              placeholder="City, PIN code or station name"
              className="min-h-[44px] w-full flex-1 rounded-token px-4 text-base"
              style={{
                background: "var(--surface)",
                color: "var(--ink)",
                border: "1px solid var(--line-strong)",
              }}
            />
            <button
              type="submit"
              className="touch-target inline-flex items-center justify-center rounded-token px-6 font-semibold"
              style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
            >
              Search
            </button>
          </form>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Link
              href="/map"
              className="touch-target inline-flex items-center justify-center rounded-token px-5 font-semibold no-underline hover:no-underline"
              style={{
                background: "var(--surface)",
                color: "var(--ink)",
                border: "1px solid var(--line-strong)",
              }}
            >
              Open the live map
            </Link>
            <Link
              href="/map"
              className="inline-flex min-h-[44px] items-center font-medium"
              style={{ color: "var(--accent-ink)" }}
            >
              Use my location on the map →
            </Link>
          </div>

          {/* Trust counter — a live figure from the dataset, never marketing copy. */}
          <p className="mt-6 text-sm" style={{ color: "var(--ink-3)" }}>
            <span className="tnum font-semibold" style={{ color: "var(--ink-2)" }}>
              {stationCount}
            </span>{" "}
            {stationCount === 1 ? "station" : "stations"} tracked across{" "}
            <span className="tnum font-semibold" style={{ color: "var(--ink-2)" }}>
              {cityCount}
            </span>{" "}
            {cityCount === 1 ? "city" : "cities"} so far — every listing sourced &amp; dated, none
            older than its stated verification date.
          </p>
        </section>

        {/* ---------- Browse by city (data-driven) ---------- */}
        {topCities.length > 0 && (
          <section
            id="cities"
            className="mx-auto w-full max-w-5xl scroll-mt-24 px-4 py-8"
            aria-labelledby="cities-heading"
          >
            <h2
              id="cities-heading"
              className="mb-1 text-xs font-semibold uppercase tracking-wide"
              style={{ color: "var(--ink-3)" }}
            >
              Browse by city
            </h2>
            <p className="mb-4 text-sm" style={{ color: "var(--ink-2)" }}>
              Live counts, straight from the dataset.
            </p>
            <ul className="flex flex-wrap gap-2" role="list">
              {topCities.map((c) => (
                <li key={c.slug}>
                  <Link
                    href={`/${c.slug}`}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-token px-4 no-underline hover:no-underline"
                    style={{
                      background: "var(--surface)",
                      color: "var(--ink)",
                      border: "1px solid var(--line)",
                    }}
                  >
                    <span className="font-medium">{c.name}</span>
                    <span
                      className="tnum rounded-full px-2 py-0.5 text-xs font-semibold"
                      style={{ background: "var(--accent-soft)", color: "var(--accent-ink)" }}
                    >
                      {c.count}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ---------- The three E0 grades ---------- */}
        <section
          className="mx-auto w-full max-w-5xl px-4 py-8"
          aria-labelledby="grades-heading"
        >
          <h2
            id="grades-heading"
            className="mb-4 text-xl font-bold sm:text-2xl"
            style={{ color: "var(--ink)" }}
          >
            The three ethanol-free grades we track
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {PRIMARY_GRADES.map((name) => {
              const meta = gm[name];
              if (!meta) return null;
              const brand = bm[meta.brand];
              const colorVar = brand ? brand.colorVar : "--ink-2";
              const n = gradeCount(name);
              return (
                <div
                  key={name}
                  className="flex flex-col rounded-token p-5 shadow-token"
                  style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="inline-block h-3 w-3 rounded-full"
                      style={{ background: `var(${colorVar})` }}
                    />
                    <span className="text-sm font-semibold" style={{ color: "var(--ink-2)" }}>
                      {brand ? brand.name : meta.brand}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold" style={{ color: "var(--ink)" }}>
                    {meta.name}
                  </h3>
                  <p className="mt-1 text-sm" style={{ color: "var(--ink-2)" }}>
                    {meta.ron} RON · ethanol-free (E0)
                  </p>
                  <p className="mt-3 text-sm" style={{ color: "var(--ink-3)" }}>
                    <span className="tnum font-semibold" style={{ color: "var(--ink-2)" }}>
                      {n}
                    </span>{" "}
                    {n === 1 ? "outlet" : "outlets"} in our dataset
                  </p>
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-sm" style={{ color: "var(--ink-3)" }}>
            We also track two clearly-labelled legacy grades —{" "}
            {LEGACY_GRADES.map((g, i) => {
              const meta = gm[g];
              return (
                <span key={g}>
                  {i > 0 ? " and " : ""}
                  <span style={{ color: "var(--ink-2)" }}>{meta ? meta.full : g}</span>
                </span>
              );
            })}{" "}
            — which the &ldquo;E0 only&rdquo; filter hides. The ubiquitous 95-RON &ldquo;premium&rdquo; grades
            (XP95, poWer 95, Speed) are E20 and out of scope.
          </p>
        </section>

        {/* ---------- Why E0? value proposition ---------- */}
        <section
          className="mx-auto w-full max-w-5xl px-4 py-8"
          aria-labelledby="why-heading"
        >
          <div
            className="rounded-token p-6 sm:p-8"
            style={{ background: "var(--surface-2)", border: "1px solid var(--line)" }}
          >
            <h2
              id="why-heading"
              className="text-xl font-bold sm:text-2xl"
              style={{ color: "var(--ink)" }}
            >
              Why ethanol-free (E0)?
            </h2>
            <div className="mt-3 space-y-4 text-base" style={{ color: "var(--ink-2)" }}>
              <p>
                Since 2025, E20 (20% ethanol) is the standard petrol at every Indian pump. Owners of
                pre-2023 and high-compression vehicles report real-world mileage losses and increased
                wear, and there is no rollback planned. The government has confirmed that exactly
                three grades stay ethanol-free — <strong>XP100</strong>, <strong>poWer 100</strong>{" "}
                and <strong>Speed 100</strong>, all 100 RON.
              </p>
              <p>
                The problem is discovery, not price. No official locator filters by fuel grade, each
                OMC is a silo, and community lists go stale. OctaneFinder aggregates all three brands
                on one map, records where each grade came from and when it was last verified, and
                surfaces a freshness signal no OMC provides — so you don&rsquo;t ride to a dry pump.
              </p>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/about"
                className="inline-flex min-h-[44px] items-center font-semibold"
                style={{ color: "var(--accent-ink)" }}
              >
                Learn how it works →
              </Link>
              <Link
                href="/attribution"
                className="inline-flex min-h-[44px] items-center font-medium"
                style={{ color: "var(--ink-2)" }}
              >
                Our data sources
              </Link>
            </div>
          </div>
        </section>

        {/* ---------- Freshness / trust explainer ---------- */}
        <section
          className="mx-auto w-full max-w-5xl px-4 py-8"
          aria-labelledby="trust-heading"
        >
          <h2
            id="trust-heading"
            className="mb-4 text-xl font-bold sm:text-2xl"
            style={{ color: "var(--ink)" }}
          >
            Sourced, dated, honest about uncertainty
          </h2>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-3" role="list">
            <li
              className="rounded-token p-5"
              style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
            >
              <h3 className="font-semibold" style={{ color: "var(--ink)" }}>
                Every listing carries provenance
              </h3>
              <p className="mt-2 text-sm" style={{ color: "var(--ink-2)" }}>
                Official OMC lists and locators, each with the source and the date it was retrieved.
              </p>
            </li>
            <li
              className="rounded-token p-5"
              style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
            >
              <h3 className="font-semibold" style={{ color: "var(--ink)" }}>
                Unverified is labelled, not hidden
              </h3>
              <p className="mt-2 text-sm" style={{ color: "var(--ink-2)" }}>
                Outlets never field-confirmed show an &ldquo;Unverified — official listing&rdquo; badge
                rather than a false promise.
              </p>
            </li>
            <li
              className="rounded-token p-5"
              style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
            >
              <h3 className="font-semibold" style={{ color: "var(--ink)" }}>
                Price only when authoritative
              </h3>
              <p className="mt-2 text-sm" style={{ color: "var(--ink-2)" }}>
                We show a price only where an OMC publishes one (BPCL Speed 100, ₹169.00/L). No
                guessed or single-sourced figures.
              </p>
            </li>
          </ul>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

// Consistent footer + grievance/help affordance on every PAGES-owned route
// (WCAG 3.2.6 Consistent Help). Kept inline because a shared Footer component is
// not part of this ownership slice.
function SiteFooter() {
  const year = new Date().getFullYear();
  const links: { href: string; label: string }[] = [
    { href: "/", label: "Home" },
    { href: "/map", label: "Map" },
    { href: "/about", label: "About" },
    { href: "/attribution", label: "Data sources & attribution" },
    { href: "/privacy", label: "Privacy" },
    { href: "/terms", label: "Terms" },
    { href: "/about#report", label: "Report an issue" },
  ];
  return (
    <footer
      className="mt-8"
      style={{ borderTop: "1px solid var(--line)", background: "var(--surface)" }}
    >
      <div className="mx-auto w-full max-w-5xl px-4 py-8">
        <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="inline-flex min-h-[44px] items-center text-sm"
              style={{ color: "var(--ink-2)" }}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <p className="mt-4 text-xs" style={{ color: "var(--ink-3)" }}>
          © {year} {SITE_NAME} · {SITE_TAGLINE}. Map data © OpenStreetMap contributors.
        </p>
        <p className="mt-1 text-xs" style={{ color: "var(--ink-3)" }}>
          {SITE_NAME} is an independent aggregator and is not affiliated with, endorsed by or
          sponsored by IndianOil, HPCL or BPCL. Grade names are trademarks of their respective
          owners. &ldquo;{SITE_NAME}&rdquo; is a provisional working name. Grades tracked:{" "}
          {ALL_GRADES.join(", ")}.
        </p>
      </div>
    </footer>
  );
}
