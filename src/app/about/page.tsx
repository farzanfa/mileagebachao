// About page `/about` (BUILD-CONTRACT §11 PAGES). Server-rendered explainer that
// carries the E0-first value proposition, the data/freshness methodology, and the
// grievance/help channel referenced from the footer (#report). AboutPage + FAQPage JSON-LD.

import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";

import { Header } from "@/components/Header";
import { publicEnv } from "@/lib/env";
import {
  FIELD_VERIFIED_MAX_DAYS,
  FRESH_MAX_DAYS,
  PRIMARY_GRADES,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TAGLINE,
} from "@/lib/constants";

const SITE_URL = publicEnv.siteUrl.replace(/\/+$/, "");

const title = `About ${SITE_NAME}`;
const description = SITE_DESCRIPTION;

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/about" },
  openGraph: {
    type: "website",
    url: "/about",
    title: `${title} · ${SITE_TAGLINE}`,
    description,
  },
};

interface Faq {
  q: string;
  a: string;
}

const FAQS: Faq[] = [
  {
    q: "What is ethanol-free (E0) petrol?",
    a: "E0 petrol contains 0% ethanol. Since 2025, ordinary Indian petrol is E20 (20% ethanol). Owners of pre-2023, high-compression and carburetted vehicles often report mileage loss and increased wear on E20, so some prefer ethanol-free fuel.",
  },
  {
    q: "Which petrol grades are ethanol-free in India?",
    a: "Three grades are supplied without ethanol, all rated 100 RON: IndianOil XP100, HPCL poWer 100 and BPCL Speed 100. The common 95-RON 'premium' grades (XP95, poWer 95, Speed) are E20 and are out of scope.",
  },
  {
    q: `Does ${SITE_NAME} show fuel prices?`,
    a: "Only when a price is authoritatively published. BPCL Speed 100 shows ₹169.00/L from BPCL's own locator. For XP100 and poWer 100, no official premium price is published, so we show no price rather than an unverified figure.",
  },
  {
    q: "How fresh is the data?",
    a: `Every listing carries the source it came from and the date it was last verified. An in-stock confirmation within ${FRESH_MAX_DAYS} days reads as fresh; within ${FIELD_VERIFIED_MAX_DAYS} days as likely; older than that as stale. Outlets never field-confirmed are badged "Unverified — official listing, not yet field-confirmed".`,
  },
  {
    q: `Is ${SITE_NAME} affiliated with IndianOil, HPCL or BPCL?`,
    a: `No. ${SITE_NAME} is an independent aggregator and is not affiliated with, endorsed by or sponsored by any oil marketing company. Grade names are trademarks of their respective owners.`,
  },
];

export default function AboutPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "AboutPage",
        "@id": `${SITE_URL}/about`,
        url: `${SITE_URL}/about`,
        name: title,
        description,
        inLanguage: "en-IN",
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQS.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
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
      <main id="main" className="mx-auto w-full max-w-3xl px-4 py-8">
        <nav aria-label="Breadcrumb" className="mb-4 text-sm">
          <ol className="flex flex-wrap items-center gap-1" style={{ color: "var(--ink-3)" }}>
            <li>
              <Link href="/" style={{ color: "var(--ink-2)" }}>
                Home
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" style={{ color: "var(--ink-2)" }}>
              About
            </li>
          </ol>
        </nav>

        <h1 className="text-3xl font-bold sm:text-4xl" style={{ color: "var(--ink)" }}>
          About {SITE_NAME}
        </h1>
        <p className="mt-3 text-lg" style={{ color: "var(--ink-2)" }}>
          {SITE_NAME} is the pan-India, all-OMC map of genuine ethanol-free (E0), 100-octane petrol —
          IndianOil XP100, HPCL poWer 100 and BPCL Speed 100 — carrying a freshness signal no fuel
          retailer provides.
        </p>

        <Section id="why" heading="Why this exists">
          <p>
            Since 2025, E20 (20% ethanol) is the standard petrol at every Indian pump, and there is
            no plan to bring back ethanol-free petrol for regular fuel. Owners of pre-2023,
            high-compression and classic vehicles report real-world mileage losses and increased
            wear, and a large share of them say they would pay more for an E0 option.
          </p>
          <p>
            The catch is that the only legal ethanol-free fuel — the three 100-RON grades — is
            nearly undiscoverable. It is a rounding error of the network (about 0.3% of outlets), no
            official locator filters by fuel grade, each oil company is a silo, and community lists
            go stale. The daily pain is availability: stock-outs, unlisted outlets and lists nobody
            dates. {SITE_NAME} solves that discovery problem.
          </p>
        </Section>

        <Section id="grades" heading="The grades we track">
          <p>
            Three first-class grades, all 100 RON and ethanol-free: <strong>IndianOil XP100</strong>,{" "}
            <strong>HPCL poWer 100</strong> and <strong>BPCL Speed 100</strong>. We also track two
            clearly-labelled legacy grades — HPCL poWer 99 (99 RON, ethanol status unknown) and BPCL
            Speed 97 (97 RON, E20, being retired) — which the &ldquo;E0 only&rdquo; filter hides. The
            ubiquitous 95-RON &ldquo;premium&rdquo; grades are E20 and out of scope: there is no
            discovery problem to solve for fuel that is sold everywhere.
          </p>
        </Section>

        <Section id="data" heading="How we source and date every listing">
          <p>
            We seed from official sources — the IndianOil XP100 retail-outlet list, HPCL&rsquo;s
            poWer 100 / poWer 99 tables, and BPCL&rsquo;s Speed 100 locator — and record for each
            listing the source, the date it was retrieved, and its verification status
            (official-listed, field-verified or stale).
          </p>
          <p>
            An in-stock confirmation within {FRESH_MAX_DAYS} days reads as fresh; within{" "}
            {FIELD_VERIFIED_MAX_DAYS} days as likely; older than that as stale. Outlets that have
            never been field-confirmed carry an{" "}
            <strong>&ldquo;Unverified — official listing, not yet field-confirmed&rdquo;</strong>{" "}
            badge. The evidence behind every station is shown in full — the positives and the gaps.
          </p>
        </Section>

        <Section id="principles" heading="What we will and won't do">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>Price only when authoritative.</strong> We show a price only where an oil
              company publishes one (BPCL Speed 100 at ₹169.00/L). We never render guessed or
              single-sourced figures as data.
            </li>
            <li>
              <strong>No star ratings or text reviews.</strong> A recency-weighted reliability score
              answers the only question that matters — is the fuel actually there — without the
              noise and defamation risk of open reviews.
            </li>
            <li>
              <strong>Browsing stays anonymous.</strong> Your location is used on-device to sort by
              distance and is not persisted. An account is needed only to contribute.
            </li>
          </ul>
        </Section>

        <Section id="report" heading="Report an issue or contribute">
          <p>
            Found a listing that is wrong, an outlet that has stopped stocking a grade, or a station
            we&rsquo;re missing? Open the station&rsquo;s detail page and use{" "}
            <strong>Report an issue</strong> to send a correction — no account required. Corrections
            reach our operations queue and are reviewed within our published service window.
          </p>
          <p>
            Enthusiast-contributors are the verification loop that makes the data trustworthy.
            Structured check-ins and an add-a-station flow open in the next release; browsing always
            stays free and anonymous.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/map"
              className="touch-target inline-flex items-center justify-center rounded-token px-5 font-semibold no-underline hover:no-underline"
              style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
            >
              Find a station to report
            </Link>
            <Link
              href="/attribution"
              className="inline-flex min-h-[44px] items-center font-medium"
              style={{ color: "var(--ink-2)" }}
            >
              Data sources &amp; attribution
            </Link>
          </div>
        </Section>

        <Section id="faq" heading="Frequently asked questions">
          <dl className="space-y-5">
            {FAQS.map((f) => (
              <div key={f.q}>
                <dt className="font-semibold" style={{ color: "var(--ink)" }}>
                  {f.q}
                </dt>
                <dd className="mt-1" style={{ color: "var(--ink-2)" }}>
                  {f.a}
                </dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section id="naming" heading="Naming & trademarks">
          <p>
            &ldquo;{SITE_NAME}&rdquo; is a provisional working name pending trademark and domain
            clearance. {SITE_NAME} is an independent aggregator and is not affiliated with, endorsed
            by or sponsored by IndianOil, HPCL or BPCL; XP100, poWer 100, Speed 100 and the OMC
            brand names are trademarks of their respective owners, used here only to identify the
            fuel each outlet stocks.
          </p>
        </Section>
      </main>
      <SiteFooter />
    </>
  );
}

function Section({
  id,
  heading,
  children,
}: {
  id: string;
  heading: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-8 scroll-mt-24" id={id} aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`} className="text-xl font-bold sm:text-2xl" style={{ color: "var(--ink)" }}>
        {heading}
      </h2>
      <div className="mt-3 space-y-4 text-base" style={{ color: "var(--ink-2)" }}>
        {children}
      </div>
    </section>
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
