// Attribution & data licences (BUILD-CONTRACT §11 LEGAL; spec §9.3 / §9.5).
// Server component, fully static, token-styled. Consolidated credits for the three
// logically separated data stores: OpenStreetMap (ODbL), GODL-India government stats,
// and our own facts-based premium-outlet register — plus fonts and OSS.

import type { CSSProperties, ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { SITE_NAME } from "@/lib/constants";
import { publicEnv } from "@/lib/env";

export const metadata: Metadata = {
  title: "Attribution & Data Licences",
  description:
    "Credits and licences for the data behind OctaneFinder: © OpenStreetMap contributors (ODbL), Government Open Data License – India, our own provenance-tracked register, fonts and open-source software.",
  alternates: { canonical: "/attribution" },
};

const LAST_UPDATED = "30 July 2026";
const OSM_COPYRIGHT = "https://www.openstreetmap.org/copyright";
const ODBL_URL = "https://opendatacommons.org/licenses/odbl/1-0/";
const GODL_URL = "https://www.data.gov.in/government-open-data-license-india";

/* ---------- shared, token-driven presentation primitives ---------- */

const shell: CSSProperties = {
  minHeight: "100vh",
  background: "var(--bg)",
  color: "var(--ink)",
  display: "flex",
  flexDirection: "column",
};
const card: CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--line)",
  borderRadius: "var(--radius)",
  boxShadow: "var(--shadow)",
  padding: "clamp(20px, 4vw, 40px)",
};
const citation: CSSProperties = {
  background: "var(--surface-2)",
  border: "1px solid var(--line)",
  borderRadius: "var(--radius-sm)",
  padding: "12px 14px",
  margin: "0 0 12px",
  color: "var(--ink-2)",
  fontSize: "0.88rem",
  lineHeight: 1.6,
};

function TopBar() {
  return (
    <header style={{ borderBottom: "1px solid var(--line)", background: "var(--surface)" }}>
      <div
        style={{
          maxWidth: 900,
          margin: "0 auto",
          padding: "14px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 9, textDecoration: "none" }}>
          <span
            aria-hidden
            style={{
              width: 26,
              height: 26,
              borderRadius: 8,
              background: "var(--accent)",
              color: "var(--accent-contrast)",
              display: "grid",
              placeItems: "center",
              fontWeight: 800,
              fontSize: 14,
            }}
          >
            O
          </span>
          <span style={{ fontWeight: 700, color: "var(--ink)" }}>{SITE_NAME}</span>
        </Link>
        <nav aria-label="Primary" style={{ display: "flex", gap: 18, fontSize: "0.92rem" }}>
          <Link href="/map" style={{ color: "var(--ink-2)" }}>Map</Link>
          <Link href="/legal" style={{ color: "var(--ink-2)" }}>Legal</Link>
        </nav>
      </div>
    </header>
  );
}

function LegalFooter() {
  const links: { href: string; label: string }[] = [
    { href: "/", label: "Home" },
    { href: "/map", label: "Map" },
    { href: "/about", label: "About" },
    { href: "/legal", label: "Legal overview" },
    { href: "/privacy", label: "Privacy" },
    { href: "/terms", label: "Terms of use" },
    { href: "/attribution", label: "Attribution" },
  ];
  return (
    <footer style={{ borderTop: "1px solid var(--line)", background: "var(--surface)", marginTop: 48 }}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 20px" }}>
        <nav aria-label="Legal" style={{ display: "flex", flexWrap: "wrap", gap: "10px 20px", fontSize: "0.9rem" }}>
          {links.map((l) => (
            <Link key={l.href} href={l.href} style={{ color: "var(--ink-2)" }}>
              {l.label}
            </Link>
          ))}
        </nav>
        <p style={{ margin: "14px 0 0", color: "var(--ink-3)", fontSize: "0.82rem" }}>
          © {new Date().getFullYear()} {SITE_NAME}. Operated by an Indian company; all data is stored
          in India (DigitalOcean BLR1, Bengaluru). Map data © OpenStreetMap contributors, ODbL.
        </p>
      </div>
    </footer>
  );
}

function H2({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2
      id={id}
      style={{
        scrollMarginTop: 24,
        fontSize: "1.28rem",
        lineHeight: 1.25,
        fontWeight: 700,
        color: "var(--ink)",
        margin: "34px 0 12px",
      }}
    >
      {children}
    </h2>
  );
}
function P({ children }: { children: ReactNode }) {
  return <p style={{ margin: "0 0 13px", color: "var(--ink-2)" }}>{children}</p>;
}
function UL({ children }: { children: ReactNode }) {
  return (
    <ul style={{ margin: "0 0 15px", paddingLeft: 22, listStyle: "disc", color: "var(--ink-2)" }}>
      {children}
    </ul>
  );
}
function LI({ children }: { children: ReactNode }) {
  return <li style={{ margin: "0 0 7px" }}>{children}</li>;
}
function B({ children }: { children: ReactNode }) {
  return <strong style={{ color: "var(--ink)", fontWeight: 600 }}>{children}</strong>;
}
function Ext({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

export default function AttributionPage() {
  const mapAttribution = publicEnv.mapAttribution;
  return (
    <div style={shell}>
      <TopBar />
      <main style={{ flex: 1, width: "100%", maxWidth: 820, margin: "0 auto", padding: "36px 20px" }}>
        <p
          style={{
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            fontSize: "0.74rem",
            fontWeight: 700,
            color: "var(--accent-ink)",
            margin: "0 0 8px",
          }}
        >
          Legal · Attribution
        </p>
        <h1 style={{ fontSize: "clamp(1.7rem, 4vw, 2.2rem)", lineHeight: 1.15, margin: "0 0 10px", color: "var(--ink)" }}>
          Attribution &amp; Data Licences
        </h1>
        <p style={{ color: "var(--ink-3)", fontSize: "0.9rem", margin: "0 0 22px" }}>
          Last updated {LAST_UPDATED}
        </p>

        <article style={card}>
          <p style={{ margin: "0 0 13px", color: "var(--ink)", fontSize: "1.02rem" }}>
            {SITE_NAME} keeps its data in <B>three logically separated stores</B>, each under its own
            licence, and never merges them row-for-row: (1) the OpenStreetMap map layer under the ODbL;
            (2) government statistics under the Government Open Data License &ndash; India; and (3) our
            own premium-outlet register, built from unprotectable facts. This page credits each source,
            as its licence requires. None of the sources below endorse {SITE_NAME}.
          </p>

          <H2 id="osm">OpenStreetMap &mdash; map geometry (ODbL)</H2>
          <P>
            The base map and geographic geometry are © <B>OpenStreetMap contributors</B> and made
            available under the <B>Open Database License (ODbL) v1.0</B>. Any produced cartography is
            licensed CC-BY-SA. On every interactive map we show the credit{" "}
            <B>&ldquo;{mapAttribution}&rdquo;</B> together with the tile / style provider credit; the
            attribution may auto-collapse on small screens but stays reachable via the map&rsquo;s info
            control.
          </P>
          <UL>
            <LI>Licence: <Ext href={ODBL_URL}>opendatacommons.org/licenses/odbl/1-0</Ext></LI>
            <LI>Copyright &amp; contributors: <Ext href={OSM_COPYRIGHT}>openstreetmap.org/copyright</Ext></LI>
            <LI>
              Map tiles / style are rendered with <B>MapLibre GL JS</B> from a self-hosted or
              third-party vector style (configured per deployment); that provider is credited on the
              map alongside the OpenStreetMap notice.
            </LI>
          </UL>
          <P>
            We use OpenStreetMap only for <B>map geometry and brand density</B> &mdash; never as the
            source of a fuel-grade fact. To respect the ODbL&rsquo;s share-alike terms we keep the OSM
            layer separate from our proprietary register; the two are linked by a one-way reference at
            most, never by copying a value across. As good citizens, we contribute verified{" "}
            <code style={{ fontFamily: "var(--font-mono)", fontSize: "0.85em" }}>fuel:octane_100=yes</code>{" "}
            tags back to OpenStreetMap after field verification.
          </P>

          <H2 id="godl">Government statistics &mdash; GODL-India</H2>
          <P>
            National coverage figures and denominators shown on our statistics and city pages come from
            open government data used under the <B>Government Open Data License &ndash; India
            (GODL-India)</B> under the National Data Sharing and Accessibility Policy. The data is
            provided &ldquo;as-is&rdquo;; the providers are not liable for it, do not guarantee
            continued updates, and their use here does <B>not</B> imply any government endorsement of
            {" "}{SITE_NAME}. No outlet-level premium-fuel data comes from government sources &mdash;
            GODL data never touches our register. Datasets used, in the licence&rsquo;s mandatory
            citation format:
          </P>
          <div style={citation}>
            Petroleum Planning &amp; Analysis Cell (PPAC), Ministry of Petroleum &amp; Natural Gas,
            Government of India, 2026, <em>Ready Reckoner (FY2025&ndash;26) &mdash; retail-outlet
            counts</em>, PPAC (ppac.gov.in), as on 01-04-2026,{" "}
            <Ext href="https://ppac.gov.in/">https://ppac.gov.in/</Ext>. Published under Government Open
            Data License &ndash; India (GODL-India): <Ext href={GODL_URL}>{GODL_URL}</Ext>.
          </div>
          <div style={citation}>
            Ministry of Petroleum &amp; Natural Gas, Government of India, 2026, <em>Reply to Lok Sabha
            Unstarred Question on premium / branded petrol share of MS sales</em>, Parliament of India
            &mdash; Lok Sabha Questions (sansad.in), 23-07-2026,{" "}
            <Ext href="https://sansad.in/">https://sansad.in/</Ext>. Published under Government Open
            Data License &ndash; India (GODL-India): <Ext href={GODL_URL}>{GODL_URL}</Ext>.
          </div>
          <div style={citation}>
            Open Government Data (OGD) Platform India, Government of India,{" "}
            <em>selected petroleum-sector datasets</em>, data.gov.in,{" "}
            <Ext href="https://www.data.gov.in/">https://www.data.gov.in/</Ext>. Published under
            Government Open Data License &ndash; India (GODL-India): <Ext href={GODL_URL}>{GODL_URL}</Ext>.
          </div>

          <H2 id="register">Our premium-outlet register &mdash; facts</H2>
          <P>
            The heart of {SITE_NAME} &mdash; which pumps stock which E0 / 100-octane grade, and how
            fresh that fact is &mdash; is our own register. It is built from <B>facts</B> (outlet name,
            RO code, address, coordinates, grade) re-keyed into our own schema from public sources, RTI
            responses, curator verification and user check-ins. Under Indian copyright law, as settled
            in <em>Eastern Book Co. v. D.B. Modak</em>, facts and public records are not protected by
            copyright; we take only facts and never mirror a source&rsquo;s layout, HTML or wording.
            Every published fact traces to a row in our append-only{" "}
            <B>data-provenance ledger</B> recording its source, licence, retrieval date and method
            &mdash; see the <Link href="/legal">Legal overview</Link> and our engineering docs
            (<code style={{ fontFamily: "var(--font-mono)", fontSize: "0.85em" }}>docs/DATA-PROVENANCE.md</code>).
          </P>

          <H2 id="trademarks">Trademarks</H2>
          <P>
            <B>IndianOil</B> and <B>XP100</B> are marks of Indian Oil Corporation Ltd; <B>HPCL</B>,{" "}
            <B>poWer 100</B> and <B>poWer 99</B> are marks of Hindustan Petroleum Corporation Ltd;{" "}
            <B>BPCL</B>, <B>Speed 100</B> and <B>Speed 97</B> are marks of Bharat Petroleum Corporation
            Ltd. All are used here nominatively, only to identify the fuel a pump sells. {SITE_NAME} is
            independent and unaffiliated. All other trademarks belong to their respective owners.
          </P>

          <H2 id="fonts">Type &amp; fonts</H2>
          <P>
            {SITE_NAME} uses <B>system font stacks only</B> &mdash; no web fonts are loaded &mdash; both
            for privacy and performance and because our content-security policy blocks external font
            requests. Text renders in your operating system&rsquo;s native UI typeface (San Francisco,
            Segoe UI, Roboto and equivalents) with a system monospace for codes.
          </P>

          <H2 id="software">Open-source software</H2>
          <P>
            {SITE_NAME} is built with open-source software, gratefully acknowledged. Principal
            components and their licences:
          </P>
          <UL>
            <LI><B>Next.js</B> &amp; <B>React</B> &mdash; MIT</LI>
            <LI><B>MapLibre GL JS</B> &mdash; BSD-3-Clause (the community fork of the last open-source Mapbox GL JS)</LI>
            <LI><B>MiniSearch</B> (client-side search) &mdash; MIT</LI>
            <LI><B>Tailwind CSS</B>, <B>PostCSS</B>, <B>Autoprefixer</B> &mdash; MIT</LI>
            <LI><B>postgres.js</B>, <B>zod</B>, <B>Auth.js (NextAuth)</B> &mdash; MIT / ISC</LI>
          </UL>
          <P>
            Full dependency licences ship with the source. If we have missed a required credit, please
            tell us and we will correct it promptly.
          </P>
          <p style={{ margin: "22px 0 0", color: "var(--ink-3)", fontSize: "0.86rem" }}>
            Related: <Link href="/legal">Legal overview</Link> ·{" "}
            <Link href="/privacy">Privacy Policy</Link> · <Link href="/terms">Terms of use</Link>.
          </p>
        </article>
      </main>
      <LegalFooter />
    </div>
  );
}
