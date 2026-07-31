// Legal overview / hub (BUILD-CONTRACT §11 LEGAL; spec §9).
// Server component, fully static, token-styled. Summarises OctaneFinder's legal posture
// and links to the Privacy Policy, Terms of Use and Attribution pages, plus the
// engineering data-provenance requirement.

import type { CSSProperties, ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { SITE_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Legal overview",
  description:
    "OctaneFinder's legal posture at a glance — an Indian-owned, India-hosted, provenance-tracked directory of ethanol-free 100-octane fuel — with links to our Privacy Policy, Terms of Use and Attribution.",
  alternates: { canonical: "/legal" },
};

const LAST_UPDATED = "30 July 2026";
const GRIEVANCE_EMAIL = "grievance@octanefinder.in";
const PRIVACY_EMAIL = "privacy@octanefinder.in";
const LEGAL_EMAIL = "legal@octanefinder.in";

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
          <Link href="/about" style={{ color: "var(--ink-2)" }}>About</Link>
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

function DocCard({
  href,
  title,
  desc,
}: {
  href: string;
  title: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      style={{
        display: "block",
        textDecoration: "none",
        background: "var(--surface-2)",
        border: "1px solid var(--line)",
        borderRadius: "var(--radius-sm)",
        padding: "16px 18px",
        color: "var(--ink)",
      }}
    >
      <div style={{ fontWeight: 700, color: "var(--ink)", margin: "0 0 4px" }}>{title}</div>
      <div style={{ color: "var(--ink-2)", fontSize: "0.9rem", lineHeight: 1.5 }}>{desc}</div>
      <div style={{ color: "var(--accent-ink)", fontSize: "0.85rem", fontWeight: 600, marginTop: 8 }}>
        Read →
      </div>
    </Link>
  );
}

export default function LegalOverviewPage() {
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
          Legal
        </p>
        <h1 style={{ fontSize: "clamp(1.7rem, 4vw, 2.2rem)", lineHeight: 1.15, margin: "0 0 10px", color: "var(--ink)" }}>
          Legal overview
        </h1>
        <p style={{ color: "var(--ink-3)", fontSize: "0.9rem", margin: "0 0 22px" }}>
          Last updated {LAST_UPDATED}
        </p>

        <article style={card}>
          <p style={{ margin: "0 0 18px", color: "var(--ink)", fontSize: "1.02rem" }}>
            {SITE_NAME} is an <B>independently owned, provenance-tracked directory</B> of petrol pumps
            in India that sell genuine ethanol-free (E0), 100-octane fuel &mdash; and of how fresh each
            of those facts is. We take our legal posture seriously because our one real asset is the
            trustworthiness of that database. This page summarises how we operate and links to the full
            documents.
          </p>

          <div
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              margin: "0 0 8px",
            }}
          >
            <DocCard
              href="/privacy"
              title="Privacy Policy"
              desc="What personal data we do and don't process, under India's DPDP Act, 2023 — built around data minimisation."
            />
            <DocCard
              href="/terms"
              title="Terms of Use"
              desc="The rules for using OctaneFinder, user contributions, and our intermediary safe-harbour and grievance mechanism."
            />
            <DocCard
              href="/attribution"
              title="Attribution & licences"
              desc="Credits for OpenStreetMap (ODbL), Government Open Data License – India, our own register, fonts and OSS."
            />
          </div>

          <H2 id="who">Who operates {SITE_NAME}</H2>
          <P>
            {SITE_NAME} is operated by an <B>Indian company</B> that owns and stores all of its data in
            India, in DigitalOcean&rsquo;s <B>BLR1 (Bengaluru)</B> region. Indian-entity ownership and
            India-resident data are deliberate choices: they keep full data rights with the company and
            keep us comfortably inside India&rsquo;s geospatial, data-protection and intermediary
            regimes. The company&rsquo;s registered name, office and identifiers are finalised at
            incorporation and published here before public launch.
          </P>

          <H2 id="provenance">Facts, not compilations &mdash; the provenance ledger</H2>
          <P>
            Everything {SITE_NAME} publishes about a pump is a <B>fact</B> &mdash; outlet name, RO code,
            address, coordinates, and which grade it stocks. Under Indian copyright law (settled in{" "}
            <em>Eastern Book Co. v. D.B. Modak</em>) facts and public records are not protected by
            copyright, and India has no separate database right. We take only facts, re-keyed into our
            own schema, and never mirror a source&rsquo;s layout, HTML or wording.
          </P>
          <P>
            To make that defensible and auditable, every displayed fact must trace to at least one row
            in an <B>append-only, immutable data-provenance ledger</B>. Each ledger row records the
            fact&rsquo;s <B>source, licence, retrieval date and acquisition method</B>, and the licence
            &ldquo;store&rdquo; it belongs to. This is a hard engineering requirement, not just
            documentation &mdash; <B>if a fact cannot be traced to a ledger row, it does not ship.</B>{" "}
            The requirement and how the database enforces it are documented for engineers in{" "}
            <code style={{ fontFamily: "var(--font-mono)", fontSize: "0.85em" }}>docs/DATA-PROVENANCE.md</code>.
          </P>

          <H2 id="stores">Three separated data stores</H2>
          <P>
            We keep three logically separated stores and never merge them row-for-row &mdash; the
            separation is a <B>licence firewall</B>:
          </P>
          <UL>
            <LI><B>Our proprietary register</B> &mdash; the facts about who sells E0 / 100-octane fuel, with per-grade provenance.</LI>
            <LI><B>An OpenStreetMap layer</B> under the ODbL &mdash; map geometry and brand density only, kept separate so its share-alike terms never reach our register.</LI>
            <LI><B>Government statistics</B> under GODL-India &mdash; national denominators and coverage figures for our stats pages.</LI>
          </UL>
          <P>Full credits are on the <Link href="/attribution">Attribution</Link> page.</P>

          <H2 id="posture">Our compliance posture, in brief</H2>
          <UL>
            <LI><B>Data protection (DPDP Act, 2023):</B> DPDP-by-design &mdash; minimal collection, on-device location, itemised notice, affirmative and easily-withdrawn consent, and a self-serve rights path. See the <Link href="/privacy">Privacy Policy</Link>.</LI>
            <LI><B>Intermediary (IT Rules, 2021):</B> once user contributions are live we operate under Section 79 safe harbour with a published Grievance Officer and defined SLAs. See the <Link href="/terms">Terms of Use</Link>.</LI>
            <LI><B>Geospatial:</B> an Indian entity needs no licence to store and publish coarse pump coordinates; we file a self-certification of adherence, and our accuracy is well inside the regulated threshold.</LI>
            <LI><B>Sourcing ethics:</B> we take facts, not compilations; we never circumvent access controls or reverse-engineer private app APIs; and we use statutory RTI requests as a primary, unimpeachable refresh channel.</LI>
            <LI><B>By design we never build:</B> free-text reviews or star ratings, single-source prices, or displays of dealer / proprietor names &mdash; each removes needless liability while keeping the data trustworthy.</LI>
          </UL>

          <H2 id="grievance">Contact &amp; grievance redressal</H2>
          <P>
            We acknowledge complaints within <B>24 hours</B> and resolve them within <B>15 days</B>
            (72 hours for specified content categories under the IT Rules). Reach us at:
          </P>
          <address
            style={{
              fontStyle: "normal",
              background: "var(--surface-2)",
              border: "1px solid var(--line)",
              borderRadius: "var(--radius-sm)",
              padding: "16px 18px",
              color: "var(--ink-2)",
              lineHeight: 1.7,
            }}
          >
            <div><B>{SITE_NAME}</B> (operated by its Indian parent company), Bengaluru, Karnataka, India</div>
            <div>Grievance Officer: <a href={`mailto:${GRIEVANCE_EMAIL}`}>{GRIEVANCE_EMAIL}</a></div>
            <div>Privacy &amp; data rights: <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a></div>
            <div>Legal notices: <a href={`mailto:${LEGAL_EMAIL}`}>{LEGAL_EMAIL}</a></div>
            <div style={{ color: "var(--ink-3)", fontSize: "0.85rem", marginTop: 6 }}>
              The current Grievance Officer&rsquo;s name and postal address are published here and kept
              up to date; corporate registration details are finalised at incorporation.
            </div>
          </address>

          <H2 id="monitored">What we keep an eye on</H2>
          <P>
            Indian law here is evolving, and we review these items quarterly rather than assume they
            stay put:
          </P>
          <UL>
            <LI>the still-unnotified geospatial &ldquo;negative list&rdquo; of restricted map attributes;</LI>
            <LI>the phased commencement of the substantive DPDP obligations (expected in 2027) and the exact penalty-power dates; and</LI>
            <LI>our headroom below the &ldquo;significant social media intermediary&rdquo; threshold (5 million registered Indian users), which triggers heavier duties we do not currently owe.</LI>
          </UL>
          <p style={{ margin: "22px 0 0", color: "var(--ink-3)", fontSize: "0.86rem" }}>
            Read next: <Link href="/privacy">Privacy Policy</Link> · <Link href="/terms">Terms of use</Link> ·{" "}
            <Link href="/attribution">Attribution</Link>.
          </p>
        </article>
      </main>
      <LegalFooter />
    </div>
  );
}
