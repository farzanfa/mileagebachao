// Station detail SEO page `/station/{slug}` (BUILD-CONTRACT §11 PAGES, §8; UI/UX §4.5.5).
// The route segment is named `[id]` but carries the station SLUG — this is the
// canonical URL used across the app: StationCard links to `/station/{slug}` and the
// UI/UX spec specifies `/station/{slug}`. Statically generated from allStations()
// (NO DB). Renders StationDetail server-side plus GasStation / LocalBusiness +
// BreadcrumbList JSON-LD and OpenGraph metadata.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Header } from "@/components/Header";
import StationDetail from "@/components/StationDetail";
import { allStations, brandMeta, gradeMeta } from "@/lib/data";
import { haversineKm } from "@/lib/geo";
import { publicEnv } from "@/lib/env";
import { PRIMARY_GRADES, SITE_NAME, SITE_TAGLINE } from "@/lib/constants";
import type { Station } from "@/lib/types";

const SITE_URL = publicEnv.siteUrl.replace(/\/+$/, "");

// All slugs known at build time; unknown slugs 404 instead of rendering.
export const dynamicParams = false;

// The [id] segment carries the station slug (canonical URL, matches StationCard).
export function generateStaticParams(): { id: string }[] {
  return allStations().map((s) => ({ id: s.slug }));
}

function stationBySlug(slug: string): Station | undefined {
  return allStations().find((s) => s.slug === slug);
}

function gradeSummary(s: Station): string {
  return s.grades.map((g) => g.grade).join(", ");
}

function nearbyStations(s: Station, limit = 4): Station[] {
  return allStations()
    .filter((o) => o.id !== s.id)
    .map((o) => ({ o, d: haversineKm({ lat: s.lat, lng: s.lng }, { lat: o.lat, lng: o.lng }) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, limit)
    .map((x) => x.o);
}

interface StationPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: StationPageProps): Promise<Metadata> {
  const { id: slug } = await params;
  const station = stationBySlug(slug);
  if (!station) {
    return { title: "Station not found", robots: { index: false, follow: false } };
  }
  const grades = gradeSummary(station);
  const title = `${station.name} — ${grades} · ${station.city}`;
  const description =
    `${station.name} in ${station.city}, ${station.state} (${station.pincode}) — ` +
    `ethanol-free (E0) 100-octane petrol: ${grades}. ` +
    `Sourced and dated by ${SITE_NAME}${station.price ? `, ${station.price.value} ${station.price.currency}/L` : ""}.`;
  const canonical = `/station/${station.slug}`;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      url: canonical,
      title: `${station.name} · ${SITE_NAME}`,
      description,
    },
  };
}

export default async function StationPage({ params }: StationPageProps) {
  const { id: slug } = await params;
  const station = stationBySlug(slug);
  if (!station) notFound();

  const bm = brandMeta();
  const gm = gradeMeta();
  const brand = bm[station.brand];
  const nearby = nearbyStations(station);
  const canonicalUrl = `${SITE_URL}/station/${station.slug}`;

  const amenityFeatures = station.grades.map((g) => {
    const meta = gm[g.grade];
    return {
      "@type": "LocationFeatureSpecification",
      name: meta ? meta.full : g.grade,
      value: true,
    };
  });

  const gasStation: Record<string, unknown> = {
    "@type": ["GasStation", "LocalBusiness"],
    "@id": canonicalUrl,
    name: station.name,
    url: canonicalUrl,
    brand: { "@type": "Brand", name: brand ? brand.name : station.brand },
    address: {
      "@type": "PostalAddress",
      streetAddress: station.address,
      addressLocality: station.city,
      addressRegion: station.state,
      postalCode: station.pincode,
      addressCountry: "IN",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: station.lat,
      longitude: station.lng,
    },
    amenityFeature: amenityFeatures,
    identifier: { "@type": "PropertyValue", name: "RO code", value: station.roCode },
  };
  if (station.phone) gasStation.telephone = station.phone;
  if (station.price) {
    gasStation.makesOffer = {
      "@type": "Offer",
      itemOffered: { "@type": "Product", name: gm[station.price.grade]?.full ?? station.price.grade },
      priceCurrency: station.price.currency,
      price: station.price.value,
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        priceCurrency: station.price.currency,
        price: station.price.value,
        unitText: "litre",
      },
      availabilityStarts: station.price.asOf,
    };
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
          {
            "@type": "ListItem",
            position: 2,
            name: station.city,
            item: `${SITE_URL}/${station.citySlug}`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: station.name,
            item: canonicalUrl,
          },
        ],
      },
      gasStation,
    ],
  };

  return (
    <>
      <Header />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main id="main" className="mx-auto w-full max-w-3xl px-4 py-8">
        {/* Breadcrumbs */}
        <nav aria-label="Breadcrumb" className="mb-4 text-sm">
          <ol className="flex flex-wrap items-center gap-1" style={{ color: "var(--ink-3)" }}>
            <li>
              <Link href="/" style={{ color: "var(--ink-2)" }}>
                Home
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link href={`/${station.citySlug}`} style={{ color: "var(--ink-2)" }}>
                {station.city}
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" style={{ color: "var(--ink-2)" }}>
              {station.name}
            </li>
          </ol>
        </nav>

        {/* Descriptive H1 for crawlers; the visible heading is provided by StationDetail. */}
        <h1 className="sr-only">
          {station.name} — {gradeSummary(station)} · ethanol-free (E0) 100-octane petrol in{" "}
          {station.city}, {station.state}
        </h1>

        <StationDetail station={station} />

        {/* Nearby alternatives — internal links + sparse-network fallback */}
        {nearby.length > 0 && (
          <section className="mt-10" aria-labelledby="nearby-heading">
            <h2
              id="nearby-heading"
              className="mb-3 text-xs font-semibold uppercase tracking-wide"
              style={{ color: "var(--ink-3)" }}
            >
              Nearby alternatives
            </h2>
            <ul className="grid grid-cols-1 gap-2" role="list">
              {nearby.map((o) => {
                const km = haversineKm(
                  { lat: station.lat, lng: station.lng },
                  { lat: o.lat, lng: o.lng },
                );
                const ob = bm[o.brand];
                return (
                  <li key={o.id}>
                    <Link
                      href={`/station/${o.slug}`}
                      className="flex items-center justify-between gap-3 rounded-token px-4 py-3 no-underline hover:no-underline"
                      style={{
                        background: "var(--surface)",
                        border: "1px solid var(--line)",
                      }}
                    >
                      <span className="flex items-center gap-2">
                        <span
                          aria-hidden="true"
                          className="inline-block h-2.5 w-2.5 rounded-full"
                          style={{ background: `var(${ob ? ob.colorVar : "--ink-2"})` }}
                        />
                        <span className="font-medium" style={{ color: "var(--ink)" }}>
                          {o.name}
                        </span>
                        <span className="text-sm" style={{ color: "var(--ink-3)" }}>
                          · {o.grades.map((g) => g.grade).join(", ")}
                        </span>
                      </span>
                      <span className="tnum whitespace-nowrap text-sm" style={{ color: "var(--ink-2)" }}>
                        {km < 10 ? km.toFixed(1) : Math.round(km)} km aerial
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <p className="mt-8 text-sm">
          <Link href={`/${station.citySlug}`} style={{ color: "var(--accent-ink)" }}>
            ← All ethanol-free stations in {station.city}
          </Link>
        </p>
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
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
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
