// City SEO page `/{citySlug}` (BUILD-CONTRACT §11 PAGES, §8; UI/UX §4.5.1).
// Statically generated from data.cities() (NO DB). Server-renders the city's
// stations via StationList, with a canonical URL, OpenGraph metadata and
// ItemList + BreadcrumbList JSON-LD. The long-tail SEO play ("XP100 in Jaipur").

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Header } from "@/components/Header";
import { StationList } from "@/components/StationList";
import { allStations, cities, gradeMeta } from "@/lib/data";
import { publicEnv } from "@/lib/env";
import {
  ALL_GRADES,
  PRIMARY_GRADES,
  SITE_NAME,
  SITE_TAGLINE,
} from "@/lib/constants";
import type { GradeName, Station } from "@/lib/types";

const SITE_URL = publicEnv.siteUrl.replace(/\/+$/, "");

// All params known at build time; unknown slugs 404 instead of rendering.
export const dynamicParams = false;

export function generateStaticParams(): { city: string }[] {
  return cities().map((c) => ({ city: c.slug }));
}

interface CityInfo {
  slug: string;
  name: string;
  state: string;
  count: number;
}

function cityBySlug(slug: string): CityInfo | undefined {
  return cities().find((c) => c.slug === slug);
}

function cityStations(slug: string): Station[] {
  return allStations()
    .filter((s) => s.citySlug === slug)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function gradesInCity(stations: Station[]): GradeName[] {
  const present = new Set<GradeName>();
  for (const s of stations) {
    for (const g of s.grades) present.add(g.grade);
  }
  // Keep canonical ordering (primary grades first, then legacy).
  return ALL_GRADES.filter((g) => present.has(g));
}

interface CityPageProps {
  params: Promise<{ city: string }>;
}

export async function generateMetadata({ params }: CityPageProps): Promise<Metadata> {
  const { city } = await params;
  const info = cityBySlug(city);
  if (!info) {
    return { title: "City not found", robots: { index: false, follow: false } };
  }
  const stations = cityStations(city);
  const grades = gradesInCity(stations);
  const gradeList = grades.length > 0 ? grades.join(", ") : "XP100, poWer 100, Speed 100";
  const title = `Ethanol-free (E0) 100-octane petrol in ${info.name}`;
  const description =
    `${info.count} ${info.count === 1 ? "outlet" : "outlets"} in ${info.name}, ${info.state} ` +
    `stocking ethanol-free (E0), 100-octane petrol (${gradeList}). ` +
    `Every listing is sourced, dated and freshness-scored by ${SITE_NAME}.`;
  const canonical = `/${info.slug}`;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      url: canonical,
      title: `${title} · ${SITE_NAME}`,
      description,
    },
  };
}

export default async function CityPage({ params }: CityPageProps) {
  const { city } = await params;
  const info = cityBySlug(city);
  if (!info) notFound();

  const stations = cityStations(city);
  const grades = gradesInCity(stations);
  const gm = gradeMeta();

  const gradeCountInCity = (g: GradeName): number =>
    stations.filter((s) => s.grades.some((x) => x.grade === g)).length;

  const otherCities = cities()
    .filter((c) => c.slug !== info.slug)
    .slice(0, 12);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
          { "@type": "ListItem", position: 2, name: info.name, item: `${SITE_URL}/${info.slug}` },
        ],
      },
      {
        "@type": "CollectionPage",
        name: `Ethanol-free (E0) 100-octane petrol in ${info.name}`,
        url: `${SITE_URL}/${info.slug}`,
        about: `Ethanol-free premium petrol outlets in ${info.name}, ${info.state}, India.`,
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: stations.length,
          itemListElement: stations.map((s, i) => ({
            "@type": "ListItem",
            position: i + 1,
            url: `${SITE_URL}/station/${s.slug}`,
            name: s.name,
          })),
        },
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
      <main id="main" className="mx-auto w-full max-w-5xl px-4 py-8">
        {/* Breadcrumbs */}
        <nav aria-label="Breadcrumb" className="mb-4 text-sm">
          <ol className="flex flex-wrap items-center gap-1" style={{ color: "var(--ink-3)" }}>
            <li>
              <Link href="/" style={{ color: "var(--ink-2)" }}>
                Home
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" style={{ color: "var(--ink-2)" }}>
              {info.name}
            </li>
          </ol>
        </nav>

        <header className="mb-6">
          <h1 className="text-3xl font-bold sm:text-4xl" style={{ color: "var(--ink)" }}>
            Ethanol-free (E0) 100-octane petrol in {info.name}
          </h1>
          <p className="mt-2 text-base" style={{ color: "var(--ink-2)" }}>
            {info.count} {info.count === 1 ? "outlet" : "outlets"} tracked in {info.name},{" "}
            {info.state}. Grade names are shown exactly as the OMC brands them; each listing carries
            its source and last-verified date.
          </p>

          {/* Per-grade counts in this city */}
          {grades.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-2" role="list">
              {grades.map((g) => {
                const meta = gm[g];
                const n = gradeCountInCity(g);
                return (
                  <li
                    key={g}
                    className="inline-flex items-center gap-2 rounded-token px-3 py-1.5 text-sm"
                    style={{ background: "var(--surface-2)", border: "1px solid var(--line)" }}
                  >
                    <span className="font-medium" style={{ color: "var(--ink)" }}>
                      {meta ? meta.name : g}
                    </span>
                    <span
                      className="tnum font-semibold"
                      style={{ color: "var(--ink-3)" }}
                    >
                      {n}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="mt-4">
            <Link
              href={`/map?q=${encodeURIComponent(info.name)}`}
              className="touch-target inline-flex items-center justify-center rounded-token px-5 font-semibold no-underline hover:no-underline"
              style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
            >
              Open {info.name} on the map
            </Link>
          </div>
        </header>

        {/* Primary visual list of the city's stations */}
        {stations.length > 0 ? (
          <section aria-label={`Stations in ${info.name}`}>
            <StationList stations={stations} />
          </section>
        ) : (
          <p
            className="rounded-token p-5"
            style={{ background: "var(--surface-2)", color: "var(--ink-2)", border: "1px solid var(--line)" }}
          >
            No ethanol-free outlets are tracked in {info.name} yet.{" "}
            <Link href="/map" style={{ color: "var(--accent-ink)" }}>
              Explore the full map
            </Link>{" "}
            for the nearest alternatives.
          </p>
        )}

        {/* Crawlable directory of station detail pages (internal linking / long-tail SEO) */}
        {stations.length > 0 && (
          <section className="mt-10" aria-labelledby="directory-heading">
            <h2
              id="directory-heading"
              className="mb-3 text-xs font-semibold uppercase tracking-wide"
              style={{ color: "var(--ink-3)" }}
            >
              All {info.name} stations
            </h2>
            <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2" role="list">
              {stations.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/station/${s.slug}`}
                    className="inline-flex min-h-[44px] items-center text-sm"
                    style={{ color: "var(--accent-ink)" }}
                  >
                    {s.name}
                    <span className="ml-2" style={{ color: "var(--ink-3)" }}>
                      · {s.grades.map((x) => x.grade).join(", ")}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Sibling city pages (internal linking) */}
        {otherCities.length > 0 && (
          <section className="mt-10" aria-labelledby="other-cities-heading">
            <h2
              id="other-cities-heading"
              className="mb-3 text-xs font-semibold uppercase tracking-wide"
              style={{ color: "var(--ink-3)" }}
            >
              Other cities
            </h2>
            <ul className="flex flex-wrap gap-2" role="list">
              {otherCities.map((c) => (
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
                    <span className="tnum text-xs" style={{ color: "var(--ink-3)" }}>
                      {c.count}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
      <SiteFooter />
    </>
  );
}

// Consistent footer + grievance/help affordance (WCAG 3.2.6). Inline: a shared
// Footer component is outside this ownership slice.
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
    <footer className="mt-8" style={{ borderTop: "1px solid var(--line)", background: "var(--surface)" }}>
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
          owners. Grades tracked: {PRIMARY_GRADES.join(", ")}.
        </p>
      </div>
    </footer>
  );
}
