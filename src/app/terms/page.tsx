// Terms of Use — UGC + IT Act s.79 safe harbour under the IT (Intermediary Guidelines
// and Digital Media Ethics Code) Rules, 2021 (BUILD-CONTRACT §11 LEGAL; spec §9.8).
// Server component, fully static, token-styled. Publishes the Grievance Officer contact
// and the Rule-3 due-diligence SLAs required to preserve safe harbour.

import type { CSSProperties, ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { SITE_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Terms of Use",
  description:
    "The terms governing use of MileageBachao, including user contributions, our intermediary status and grievance-redressal mechanism under India's IT Rules, 2021.",
  alternates: { canonical: "/terms" },
};

const LAST_UPDATED = "30 July 2026";
const GRIEVANCE_EMAIL = "grievance@mileagebachao.in";
const LEGAL_EMAIL = "legal@mileagebachao.in";

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

export default function TermsPage() {
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
          Legal · Terms
        </p>
        <h1 style={{ fontSize: "clamp(1.7rem, 4vw, 2.2rem)", lineHeight: 1.15, margin: "0 0 10px", color: "var(--ink)" }}>
          Terms of Use
        </h1>
        <p style={{ color: "var(--ink-3)", fontSize: "0.9rem", margin: "0 0 22px" }}>
          Last updated {LAST_UPDATED} · Effective {LAST_UPDATED}
        </p>

        <article style={card}>
          <p style={{ margin: "0 0 13px", color: "var(--ink)", fontSize: "1.02rem" }}>
            These Terms of Use (&ldquo;Terms&rdquo;) govern your use of {SITE_NAME}, a website and web
            app that helps you locate petrol pumps in India stocking ethanol-free (E0), 100-octane
            fuel. By accessing or using {SITE_NAME}, you agree to these Terms and to our{" "}
            <Link href="/privacy">Privacy Policy</Link>. If you do not agree, please do not use the
            service.
          </p>

          <nav aria-label="On this page" style={{ margin: "18px 0 4px" }}>
            <p style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" }}>
              On this page
            </p>
            <ol style={{ margin: 0, paddingLeft: 20, color: "var(--accent-ink)", fontSize: "0.92rem", columnGap: 28, columnCount: 2 }}>
              <li style={{ margin: "0 0 6px" }}><a href="#service">What MileageBachao is</a></li>
              <li style={{ margin: "0 0 6px" }}><a href="#eligibility">Eligibility</a></li>
              <li style={{ margin: "0 0 6px" }}><a href="#accuracy">Accuracy, freshness &amp; prices</a></li>
              <li style={{ margin: "0 0 6px" }}><a href="#acceptable">Acceptable use</a></li>
              <li style={{ margin: "0 0 6px" }}><a href="#ugc">Your contributions (UGC)</a></li>
              <li style={{ margin: "0 0 6px" }}><a href="#prohibited">Prohibited content</a></li>
              <li style={{ margin: "0 0 6px" }}><a href="#intermediary">Our role &amp; safe harbour</a></li>
              <li style={{ margin: "0 0 6px" }}><a href="#grievance">Grievance redressal</a></li>
              <li style={{ margin: "0 0 6px" }}><a href="#ip">Intellectual property</a></li>
              <li style={{ margin: "0 0 6px" }}><a href="#disclaimer">Disclaimers &amp; liability</a></li>
              <li style={{ margin: "0 0 6px" }}><a href="#law">Governing law</a></li>
              <li style={{ margin: "0 0 6px" }}><a href="#contact">Contact &amp; changes</a></li>
            </ol>
          </nav>

          <H2 id="service">1. What {SITE_NAME} is &mdash; and isn&rsquo;t</H2>
          <P>
            {SITE_NAME} is an <B>independent, informational directory</B>. We compile{" "}
            <B>facts</B> &mdash; outlet name, RO code, address, coordinates, brand and which E0 /
            100-octane grade a pump stocks &mdash; from public sources, our own field research and
            user contributions, and re-key them into our own schema.
          </P>
          <P>
            {SITE_NAME} is <B>not affiliated with, endorsed by, or an agent of</B> Indian Oil
            Corporation Ltd (IndianOil), Hindustan Petroleum Corporation Ltd (HPCL) or Bharat
            Petroleum Corporation Ltd (BPCL). Grade names such as <B>XP100</B>, <B>poWer</B> and{" "}
            <B>Speed</B>, and the oil-company names and logos, are the trademarks of their respective
            owners; we refer to them only to identify the fuel a pump sells (nominative fair use).
          </P>

          <H2 id="eligibility">2. Eligibility</H2>
          <P>
            You must be at least 18 years old, or use {SITE_NAME} under the supervision of a parent or
            legal guardian who accepts these Terms. By contributing you confirm you are legally able
            to enter into these Terms.
          </P>

          <H2 id="accuracy">3. Accuracy, freshness &amp; prices</H2>
          <P>
            Fuel availability changes constantly. We show a <B>freshness indicator</B> and a status
            label (official-listed, field-verified or stale) with every grade so you can judge how
            current a fact is, and we flag pumps we have never field-confirmed as{" "}
            <B>&ldquo;Unverified &mdash; official listing, not yet field-confirmed&rdquo;</B>. Even so,
            information may be out of date or incorrect, and we make <B>no warranty</B> that a given
            grade is in stock. Always confirm at the pump.
          </P>
          <Callout>
            <B>Prices.</B> We show a price only when it comes from an authoritative source, and we
            deliberately do <B>not</B> publish crowd-sourced or single-source prices. Where no
            authoritative price exists, none is shown. {SITE_NAME} does not sell fuel, does not set
            prices, and is not a fuel-quality certification service.
          </Callout>

          <H2 id="acceptable">4. Acceptable use</H2>
          <P>You agree not to:</P>
          <UL>
            <LI>use the service unlawfully, or to infringe anyone&rsquo;s rights;</LI>
            <LI>
              scrape, bulk-download, systematically extract or re-host our proprietary register or
              content except as expressly permitted (the OpenStreetMap map layer remains available
              under its own ODbL licence &mdash; see <Link href="/attribution">Attribution</Link>);
            </LI>
            <LI>probe, disable, overload or circumvent security, rate-limits or access controls;</LI>
            <LI>misrepresent your identity or submit knowingly false pump information; or</LI>
            <LI>use automated means to access the service in a way that burdens our infrastructure.</LI>
          </UL>

          <H2 id="ugc">5. Your contributions (user-generated content)</H2>
          <P>
            When contributor features are live (v1.1) you may submit <B>check-ins</B>, <B>corrections</B>,
            <B> add-a-station</B> reports and <B>photos</B> (&ldquo;Contributions&rdquo;). You are
            responsible for your Contributions and represent that:
          </P>
          <UL>
            <LI>they are accurate to the best of your knowledge and made in good faith;</LI>
            <LI>you have the rights to submit them, including any photo you upload; and</LI>
            <LI>they do not fall in any prohibited category below.</LI>
          </UL>
          <P>
            You keep ownership of your Contributions. You grant {SITE_NAME} a{" "}
            <B>worldwide, non-exclusive, royalty-free, sub-licensable licence</B> to store, reproduce,
            adapt, publish and display them for the purpose of operating and improving the service,
            including combining a check-in&rsquo;s <em>facts</em> into our aggregate availability data.
            Verified pump-availability tags may also be contributed back to OpenStreetMap under ODbL.
          </P>
          <Callout>
            <B>We do not host free-text reviews or star ratings.</B> By design, {SITE_NAME} carries
            structured availability signals only. This keeps the service factual and keeps our
            content-moderation surface small.
          </Callout>

          <H2 id="prohibited">6. Prohibited content</H2>
          <P>
            You must not submit, and are prohibited from hosting, transmitting or sharing through the
            service, any content that (this list mirrors Rule 3(1)(b) of the IT Rules, 2021):
          </P>
          <UL>
            <LI>belongs to another person and to which you have no right;</LI>
            <LI>is defamatory, obscene, pornographic, paedophilic, or invasive of another&rsquo;s privacy including bodily privacy;</LI>
            <LI>is harmful to a child;</LI>
            <LI>infringes any patent, trademark, copyright or other proprietary right;</LI>
            <LI>violates any law for the time being in force;</LI>
            <LI>is knowingly false or misleading, or impersonates another person;</LI>
            <LI>threatens the unity, integrity, defence, security or sovereignty of India, friendly relations with foreign States, or public order; or</LI>
            <LI>contains software viruses or any code designed to disrupt or damage any computer resource.</LI>
          </UL>

          <H2 id="intermediary">7. Our role &amp; safe harbour</H2>
          <P>
            Once user Contributions are enabled, {SITE_NAME} is an <B>intermediary</B> under the
            Information Technology Act, 2000 and claims safe harbour under <B>Section 79</B>, subject
            to the due-diligence obligations of the IT Rules, 2021. We do not initiate, select the
            receiver of, or modify the substance of user Contributions. We do not pre-screen every
            Contribution, but we may remove or disable access to any content that violates these
            Terms or the law, and we act on valid legal orders and grievances as set out below. Our
            publishing a Contribution is not an endorsement of it.
          </P>

          <H2 id="grievance">8. Grievance-redressal mechanism</H2>
          <P>
            We publish a Grievance Officer and operate to the following service levels, in line with
            the IT Rules, 2021:
          </P>
          <div style={{ overflowX: "auto", margin: "0 0 16px" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 520 }}>
              <thead>
                <tr>
                  <th style={th}>When you contact us</th>
                  <th style={th}>What we do</th>
                  <th style={th}>By when</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={td}>Any complaint about content or the service</td>
                  <td style={td}>Acknowledge receipt</td>
                  <td style={td}>Within <B>24 hours</B></td>
                </tr>
                <tr>
                  <td style={td}>Any complaint about content or the service</td>
                  <td style={td}>Dispose of / resolve the complaint</td>
                  <td style={td}>Within <B>15 days</B></td>
                </tr>
                <tr>
                  <td style={td}>Complaint in a specified category (e.g. impersonation, privacy invasion, nudity)</td>
                  <td style={td}>Act to remove or disable the content</td>
                  <td style={td}>Within <B>72 hours</B></td>
                </tr>
                <tr>
                  <td style={td}>Order of a court or authorised government agency</td>
                  <td style={td}>Remove or disable access to the specified content</td>
                  <td style={td}>Within <B>36 hours</B></td>
                </tr>
                <tr>
                  <td style={td}>Lawful request for information from an authorised agency</td>
                  <td style={td}>Provide information / assistance</td>
                  <td style={td}>Within <B>72 hours</B></td>
                </tr>
              </tbody>
            </table>
          </div>
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
            <div><B>Grievance Officer</B></div>
            <div>{SITE_NAME} (operated by its Indian parent company)</div>
            <div>Bengaluru, Karnataka, India</div>
            <div>
              Email: <a href={`mailto:${GRIEVANCE_EMAIL}`}>{GRIEVANCE_EMAIL}</a>
            </div>
            <div style={{ color: "var(--ink-3)", fontSize: "0.85rem", marginTop: 6 }}>
              The Grievance Officer&rsquo;s name and postal address are published here and kept
              current. If you are dissatisfied with the resolution, you may appeal to the{" "}
              <B>Grievance Appellate Committee</B> constituted under the IT Rules, 2021 within 30 days.
            </div>
          </address>

          <H2 id="ip">9. Intellectual property</H2>
          <P>
            The {SITE_NAME} name, look-and-feel, software and the selection and arrangement of our
            proprietary register are protected by law. Map geometry is © OpenStreetMap contributors and
            licensed under the ODbL; government statistics are used under the GODL-India licence; and
            oil-company names, grade names and logos belong to their owners. Full credits are on the{" "}
            <Link href="/attribution">Attribution</Link> page. Nothing here transfers any of these
            rights to you.
          </P>

          <H2 id="disclaimer">10. Disclaimers &amp; limitation of liability</H2>
          <P>
            {SITE_NAME} is provided <B>&ldquo;as is&rdquo; and &ldquo;as available&rdquo;</B>, without
            warranties of any kind, express or implied, including as to accuracy, fitness for a
            particular purpose, or uninterrupted availability. To the maximum extent permitted by law,
            {SITE_NAME} and its operators are <B>not liable</B> for any indirect, incidental, special
            or consequential loss, or for any loss arising from reliance on pump availability, grade or
            price information, or from your use of third-party navigation, mapping or fuel services. You
            agree to indemnify {SITE_NAME} against claims arising from your Contributions or your breach
            of these Terms.
          </P>

          <H2 id="law">11. Governing law &amp; jurisdiction</H2>
          <P>
            These Terms are governed by the laws of <B>India</B>. Subject to any non-waivable statutory
            grievance and appellate routes, the courts at <B>Bengaluru, Karnataka</B> have exclusive
            jurisdiction over any dispute arising out of or relating to these Terms or the service.
          </P>

          <H2 id="contact">12. Contact &amp; changes</H2>
          <P>
            For legal notices, write to <a href={`mailto:${LEGAL_EMAIL}`}>{LEGAL_EMAIL}</a>; for
            complaints, use the Grievance Officer contact above. We may update these Terms from time to
            time; the &ldquo;last updated&rdquo; date reflects the current version, effective{" "}
            {LAST_UPDATED}. Continued use after a change means you accept the updated Terms.
          </P>
          <p style={{ margin: "22px 0 0", color: "var(--ink-3)", fontSize: "0.86rem" }}>
            Related: <Link href="/privacy">Privacy Policy</Link> ·{" "}
            <Link href="/attribution">Data &amp; attribution</Link> ·{" "}
            <Link href="/legal">Legal overview</Link>.
          </p>
        </article>
      </main>
      <LegalFooter />
    </div>
  );
}
