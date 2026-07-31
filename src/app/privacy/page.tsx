// Privacy Policy — DPDP Act 2023 + DPDP Rules 2025 (BUILD-CONTRACT §11 LEGAL; spec §9.7).
// Server component, fully static, styled with design tokens. Grounded in the binding
// legal spec: data minimisation, itemised notice, affirmative consent, retention/erasure,
// data-principal rights, and a published Grievance / Data-Protection contact.

import type { CSSProperties, ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { SITE_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How MileageBachao collects, uses, stores and protects personal data under India's Digital Personal Data Protection Act, 2023 — built around data minimisation.",
  alternates: { canonical: "/privacy" },
};

const LAST_UPDATED = "30 July 2026";
const GRIEVANCE_EMAIL = "grievance@octanefinder.in";
const PRIVACY_EMAIL = "privacy@octanefinder.in";

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
const th: CSSProperties = {
  textAlign: "left",
  verticalAlign: "top",
  padding: "10px 12px",
  borderBottom: "1px solid var(--line-strong)",
  color: "var(--ink)",
  fontWeight: 600,
  fontSize: "0.86rem",
};
const td: CSSProperties = {
  textAlign: "left",
  verticalAlign: "top",
  padding: "10px 12px",
  borderBottom: "1px solid var(--line)",
  color: "var(--ink-2)",
  fontSize: "0.9rem",
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
        <Link
          href="/"
          style={{ display: "inline-flex", alignItems: "center", gap: 9, textDecoration: "none" }}
        >
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
          <Link href="/map" style={{ color: "var(--ink-2)" }}>
            Map
          </Link>
          <Link href="/legal" style={{ color: "var(--ink-2)" }}>
            Legal
          </Link>
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
    <footer
      style={{
        borderTop: "1px solid var(--line)",
        background: "var(--surface)",
        marginTop: 48,
      }}
    >
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 20px" }}>
        <nav
          aria-label="Legal"
          style={{ display: "flex", flexWrap: "wrap", gap: "10px 20px", fontSize: "0.9rem" }}
        >
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
function Callout({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        background: "var(--accent-soft)",
        border: "1px solid var(--line)",
        borderLeft: "3px solid var(--accent)",
        borderRadius: "var(--radius-sm)",
        padding: "14px 16px",
        margin: "0 0 16px",
        color: "var(--ink)",
      }}
    >
      {children}
    </div>
  );
}

export default function PrivacyPage() {
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
          Legal · Privacy
        </p>
        <h1 style={{ fontSize: "clamp(1.7rem, 4vw, 2.2rem)", lineHeight: 1.15, margin: "0 0 10px", color: "var(--ink)" }}>
          Privacy Policy
        </h1>
        <p style={{ color: "var(--ink-3)", fontSize: "0.9rem", margin: "0 0 22px" }}>
          Last updated {LAST_UPDATED} · Effective {LAST_UPDATED}
        </p>

        <article style={card}>
          <p style={{ margin: "0 0 13px", color: "var(--ink)", fontSize: "1.02rem" }}>
            {SITE_NAME} helps you find petrol pumps in India that stock ethanol-free (E0), 100-octane
            fuel. This policy explains what personal data we do and do not process, why, and the
            rights you have under India&rsquo;s <B>Digital Personal Data Protection Act, 2023</B>{" "}
            (&ldquo;DPDP Act&rdquo;) and the <B>DPDP Rules, 2025</B>. Our guiding principle is{" "}
            <B>data minimisation</B>: the surest way to protect your data is not to collect it in the
            first place, and for most of {SITE_NAME} we don&rsquo;t.
          </p>

          <nav aria-label="On this page" style={{ margin: "18px 0 4px" }}>
            <p style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" }}>
              On this page
            </p>
            <ol style={{ margin: 0, paddingLeft: 20, color: "var(--accent-ink)", fontSize: "0.92rem", columnGap: 28, columnCount: 2 }}>
              <li style={{ margin: "0 0 6px" }}><a href="#who">Who we are</a></li>
              <li style={{ margin: "0 0 6px" }}><a href="#collect">What we collect (itemised notice)</a></li>
              <li style={{ margin: "0 0 6px" }}><a href="#consent">Notice &amp; consent</a></li>
              <li style={{ margin: "0 0 6px" }}><a href="#cookies">Cookies &amp; local storage</a></li>
              <li style={{ margin: "0 0 6px" }}><a href="#location">Your location</a></li>
              <li style={{ margin: "0 0 6px" }}><a href="#sharing">Sharing &amp; disclosure</a></li>
              <li style={{ margin: "0 0 6px" }}><a href="#storage">Where data is stored &amp; security</a></li>
              <li style={{ margin: "0 0 6px" }}><a href="#retention">Retention &amp; erasure</a></li>
              <li style={{ margin: "0 0 6px" }}><a href="#rights">Your rights</a></li>
              <li style={{ margin: "0 0 6px" }}><a href="#children">Children</a></li>
              <li style={{ margin: "0 0 6px" }}><a href="#grievance">Grievance &amp; DPO contact</a></li>
              <li style={{ margin: "0 0 6px" }}><a href="#changes">Changes to this policy</a></li>
            </ol>
          </nav>

          <H2 id="who">1. Who we are</H2>
          <P>
            {SITE_NAME} is operated by an Indian company (&ldquo;{SITE_NAME}&rdquo;, &ldquo;we&rdquo;,
            &ldquo;us&rdquo;, &ldquo;our&rdquo;) that owns and stores the underlying dataset in India.
            For personal data processed through this service, we are the <B>Data Fiduciary</B> under
            the DPDP Act. Our full corporate name, registered office and CIN are published on the{" "}
            <Link href="/legal">Legal overview</Link> page and are kept current.
          </P>
          <P>
            The pump information we publish &mdash; outlet name, RO code, address, coordinates, brand
            and which grades a pump stocks &mdash; is <B>business fact, not personal data</B>. We
            deliberately display <B>no dealer / proprietor names</B>. DPDP therefore bites only on the
            limited personal data described below.
          </P>

          <H2 id="collect">2. What we collect &mdash; itemised notice</H2>
          <P>
            The following table is our itemised notice under Rule 3 of the DPDP Rules, 2025. Where a
            row is marked <B>v1.1</B>, that processing only begins when contributor accounts and
            check-ins ship; browsing {SITE_NAME} today (v1.0) requires <B>no account and no personal
            data at all</B>.
          </P>
          <div style={{ overflowX: "auto", margin: "0 0 16px" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 620 }}>
              <thead>
                <tr>
                  <th style={th}>What</th>
                  <th style={th}>Why (purpose)</th>
                  <th style={th}>Legal basis</th>
                  <th style={th}>Kept?</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={td}>Your device location for &ldquo;near me&rdquo; distance</td>
                  <td style={td}>Sort/show nearby pumps and distances</td>
                  <td style={td}>Your browser permission; processed on-device</td>
                  <td style={td}><B>Never stored or sent to us</B></td>
                </tr>
                <tr>
                  <td style={td}>Theme preference (light/dark)</td>
                  <td style={td}>Remember your display choice</td>
                  <td style={td}>Strictly-necessary local storage</td>
                  <td style={td}>In your browser only</td>
                </tr>
                <tr>
                  <td style={td}>Minimal server/access logs (IP, user-agent, timestamp, path)</td>
                  <td style={td}>Security, abuse prevention, rate-limiting, debugging</td>
                  <td style={td}>Legitimate uses (security of the service)</td>
                  <td style={td}>Short-lived; then deleted/aggregated</td>
                </tr>
                <tr>
                  <td style={td}>Account identifier &mdash; email (magic-link) or Google sign-in ID <B>(v1.1)</B></td>
                  <td style={td}>Let you contribute (check-ins, corrections)</td>
                  <td style={td}>Your consent, at sign-up</td>
                  <td style={td}>Until you delete your account</td>
                </tr>
                <tr>
                  <td style={td}>Check-in events &mdash; station, grade, result, timestamp, your user ID <B>(v1.1)</B></td>
                  <td style={td}>Keep availability data fresh and trustworthy</td>
                  <td style={td}>Your consent, at the prompt</td>
                  <td style={td}>Retained as a contribution record</td>
                </tr>
                <tr>
                  <td style={td}>Optional contact you add to a correction / report</td>
                  <td style={td}>Follow up on your report if you ask us to</td>
                  <td style={td}>Your consent, when you provide it</td>
                  <td style={td}>Only as needed to resolve the report</td>
                </tr>
                <tr>
                  <td style={td}>Photos you upload for a pump <B>(v1.1)</B></td>
                  <td style={td}>Illustrate an outlet / support a correction</td>
                  <td style={td}>Your consent, at upload</td>
                  <td style={td}>Until removed by you or moderation</td>
                </tr>
              </tbody>
            </table>
          </div>
          <Callout>
            <B>We do not:</B> sell or rent personal data; run third-party advertising or cross-site
            tracking; collect phone numbers or OTPs at launch; build user profiles; or store a
            history of where you have physically been.
          </Callout>

          <H2 id="consent">3. Notice &amp; consent</H2>
          <P>
            Where processing relies on your consent, we ask for it by a clear, unambiguous{" "}
            <B>affirmative action</B> at the moment the data is needed &mdash; for example, when you
            create an account or when your browser prompts to share your location for a check-in. The
            request is in plain language, states the specific purpose, and links to this policy.
          </P>
          <P>
            <B>Withdrawing consent is as easy as giving it.</B> You can withdraw at any time from your
            account settings (v1.1) or by writing to{" "}
            <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>. Withdrawal does not affect
            processing already carried out lawfully, and some contributions you have published may
            remain as an anonymised record where we have a legal obligation to retain them.
          </P>

          <H2 id="cookies">4. Cookies &amp; local storage</H2>
          <P>
            {SITE_NAME} uses <B>no advertising or analytics cookies</B> and no third-party trackers.
            We use a small amount of first-party browser storage that is strictly necessary for the
            site to work &mdash; for example, remembering your light/dark theme and, in v1.1, keeping
            you signed in. This information stays on your device and is not used to track you across
            other websites.
          </P>

          <H2 id="location">5. Your location</H2>
          <P>
            Location is the most sensitive data a pump-finder could touch, so we designed it out of
            the server entirely:
          </P>
          <UL>
            <LI>
              <B>&ldquo;Near me&rdquo; distances are computed in your browser.</B> When you allow
              location, your coordinates are used on your device to sort and measure distance to
              pumps. They are <B>never transmitted to us and never stored.</B>
            </LI>
            <LI>
              <B>Navigation hand-off uses our coordinates, not yours.</B> When you tap
              &ldquo;Directions&rdquo;, we open your map app using the <B>pump&rsquo;s</B> stored
              coordinates via a standard OS deep link. We do not round-trip your position through a
              third party.
            </LI>
            <LI>
              <B>Geofenced check-ins (v1.1)</B> ask for your location only to confirm you are at the
              pump. That coordinate is used transiently to validate the geofence and is{" "}
              <B>not stored</B> &mdash; we keep only the check-in event (station, grade, result,
              time, your user ID), never a location trail. If you decline, you can still check in via
              a city picker.
            </LI>
          </UL>

          <H2 id="sharing">6. Sharing &amp; disclosure</H2>
          <P>We share personal data only in these narrow cases:</P>
          <UL>
            <LI>
              <B>Processors acting for us</B> under contract &mdash; e.g. our India-region hosting
              provider, and (in v1.1) an email delivery provider for magic-links, an identity
              provider if you choose Google sign-in, and object storage for images. They may process
              data only on our instructions.
            </LI>
            <LI>
              <B>Legal &amp; safety</B> &mdash; to comply with a valid court order or lawful request
              from an authorised government agency, or to protect the rights, safety and security of
              users and the service.
            </LI>
          </UL>
          <P>We never sell personal data, and we do not transfer it for others&rsquo; marketing.</P>

          <H2 id="storage">7. Where data is stored &amp; security</H2>
          <P>
            All {SITE_NAME} data is stored in <B>India</B>, in DigitalOcean&rsquo;s{" "}
            <B>BLR1 (Bengaluru)</B> region. We apply reasonable security safeguards appropriate to the
            limited data we hold &mdash; encryption in transit, access controls, least-privilege
            credentials, an append-only provenance ledger for the dataset, and rate-limiting on write
            endpoints. If a personal-data breach ever occurs, we will notify the Data Protection Board
            of India and affected users as required by the DPDP Rules.
          </P>

          <H2 id="retention">8. Retention &amp; erasure</H2>
          <P>
            We keep personal data only as long as the purpose it was collected for is served, then
            erase it. Two specifics:
          </P>
          <UL>
            <LI>
              <B>Contribution records.</B> Where we are required by the IT (Intermediary Guidelines)
              Rules, 2021 to retain user-registration and removed-content records for <B>180 days</B>,
              we keep that forensic record and then erase it &mdash; the 180-day duty and DPDP erasure
              interoperate rather than conflict.
            </LI>
            <LI>
              <B>Account deletion.</B> When you delete your account we remove your account identifier
              and de-link your contributions; published availability facts may persist in aggregate
              and anonymised form because they are business facts about pumps, not about you.
            </LI>
          </UL>

          <H2 id="rights">9. Your rights as a Data Principal</H2>
          <P>Under the DPDP Act you have the right to:</P>
          <UL>
            <LI><B>Access</B> a summary of the personal data we process about you and how;</LI>
            <LI><B>Correction, completion and updating</B> of inaccurate or incomplete data;</LI>
            <LI><B>Erasure</B> of your personal data where the purpose is served or you withdraw consent;</LI>
            <LI><B>Grievance redressal</B> through the mechanism below; and</LI>
            <LI><B>Nominate</B> another individual to exercise your rights in the event of death or incapacity.</LI>
          </UL>
          <P>
            To exercise any right, write to <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a> (or,
            in v1.1, use the self-serve export/erasure controls in your account). We respond within the
            timelines set out below. If you are not satisfied, you may complain to the{" "}
            <B>Data Protection Board of India</B>.
          </P>

          <H2 id="children">10. Children</H2>
          <P>
            {SITE_NAME} is a general-audience utility not directed at children. We do not knowingly
            process the personal data of anyone under 18 without verifiable parental consent, and we do
            not undertake tracking, behavioural monitoring or targeted advertising directed at children.
            If you believe a child has provided us personal data, contact us and we will delete it.
          </P>

          <H2 id="grievance">11. Grievance Officer &amp; Data-Protection contact</H2>
          <P>
            We publish a contact for privacy questions and grievances, as required by the DPDP Rules and
            the IT Rules, 2021. We <B>acknowledge complaints within 24 hours</B> and <B>resolve them
            within 15 days</B> (complaints in the specified categories under the IT Rules are actioned
            within 72 hours).
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
            <div><B>Grievance Officer &amp; Data-Protection contact</B></div>
            <div>{SITE_NAME} (operated by its Indian parent company)</div>
            <div>Bengaluru, Karnataka, India</div>
            <div>
              Grievances: <a href={`mailto:${GRIEVANCE_EMAIL}`}>{GRIEVANCE_EMAIL}</a>
            </div>
            <div>
              Privacy &amp; data rights: <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>
            </div>
            <div style={{ color: "var(--ink-3)", fontSize: "0.85rem", marginTop: 6 }}>
              The name and postal address of the current Grievance Officer are published here and kept
              up to date; they are finalised at incorporation and before user contributions go live.
            </div>
          </address>

          <H2 id="changes">12. Changes to this policy</H2>
          <P>
            We may update this policy as the service and the law evolve &mdash; notably as the
            substantive DPDP obligations commence (expected in 2027). When we make material changes we
            will update the &ldquo;last updated&rdquo; date above and, where required, seek fresh
            consent. This version is effective {LAST_UPDATED}.
          </P>
          <p style={{ margin: "22px 0 0", color: "var(--ink-3)", fontSize: "0.86rem" }}>
            Related: <Link href="/terms">Terms of use</Link> ·{" "}
            <Link href="/attribution">Data &amp; attribution</Link> ·{" "}
            <Link href="/legal">Legal overview</Link>.
          </p>
        </article>
      </main>
      <LegalFooter />
    </div>
  );
}
