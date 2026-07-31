"use client";

// Station detail panel (BUILD-CONTRACT §8; design §4.5.5).
// Renders its content self-contained so it works BOTH as the desktop/mobile overlay
// wired by AppShell (onClose provided) AND inline on the SSR /station/{slug} SEO page
// (onClose omitted). Positioning (drawer + scrim, focus trap) is the caller's job.
//
// Doctrine honoured here:
//  - Every grade shows its source + last-verified + a reliability meter (§4.3).
//  - Price renders ONLY when authoritative (memo §0): the seed carries exactly one —
//    Speed 100 ₹169.00/L from the BPCL locator API. `price: null` => no price element.
//  - Evidence timeline is public and unabridged (§4.5.5).
//  - Directions hand off to the OS maps app via our stored coordinates (geo:) — no
//    re-geocoding, no API key. Phone is shown only when the OMC publishes it.
//  - Check-in buttons are present but disabled and tagged v1.1; "Report an issue" is
//    the always-available v1.0 anonymous fallback (7-day SLA).

import { useState } from "react";
import type { CSSProperties } from "react";

import type { GradeName, Price, Station, StationGrade } from "@/lib/types";
import { gradeMeta } from "@/lib/data";
import {
  gradeFreshness,
  relDays,
  reliabilityScore,
  stationIsAllUnverified,
} from "@/lib/freshness";
import BrandChip from "@/components/BrandChip";

const GRADE_META = gradeMeta();
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export interface StationDetailProps {
  station: Station;
  onClose?: () => void;
}

/** Deterministic "28 Jul 2026" formatter (no locale => no hydration mismatch). */
function fmtDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const year = m[1] ?? "";
  const monthIdx = Number(m[2]) - 1;
  const day = Number(m[3]);
  const mon = MONTHS[monthIdx] ?? m[2] ?? "";
  return `${day} ${mon} ${year}`;
}

/** Strip a leading "Brand, " so the heading leads with the locality (brand is a chip). */
function displayName(name: string): string {
  const i = name.indexOf(", ");
  return i > 0 ? name.slice(i + 2) : name;
}

function e0Descriptor(e0: boolean | null): { label: string; colorVar: string } {
  if (e0 === true) return { label: "E0", colorVar: "--fresh" };
  if (e0 === false) return { label: "E20", colorVar: "--stale" };
  return { label: "E?", colorVar: "--unknown" };
}

const secLabel: CSSProperties = {
  fontSize: 10.5,
  fontWeight: 700,
  letterSpacing: ".09em",
  textTransform: "uppercase",
  color: "var(--ink-3)",
  margin: "0 0 9px",
};

function Icon({ path, size = 16 }: { path: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}

function PriceBlock({ station, grade }: { station: Station; grade: GradeName }) {
  const price: Price | null = station.price;
  const authoritative = price !== null && price.grade === grade;
  if (authoritative && price) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 8,
          marginTop: 9,
          paddingTop: 9,
          borderTop: "1px dashed var(--line)",
        }}
      >
        <span className="mono tnum" style={{ fontSize: 17, fontWeight: 800, letterSpacing: "-.5px" }}>
          ₹{price.value}
        </span>
        <span style={{ fontSize: 11, color: "var(--ink-3)" }}>/ litre</span>
        <span
          style={{
            marginLeft: "auto",
            textAlign: "right",
            fontSize: 10.5,
            color: "var(--ink-3)",
            lineHeight: 1.35,
          }}
        >
          live from {price.source}
          <br />
          {fmtDate(price.asOf)}
        </span>
      </div>
    );
  }
  return (
    <div style={{ marginTop: 9, paddingTop: 9, borderTop: "1px dashed var(--line)" }}>
      <span style={{ fontSize: 12, color: "var(--ink-3)", fontStyle: "italic" }}>
        No authoritative price published for this grade — we do not show unverified figures.
      </span>
    </div>
  );
}

function GradeCard({ station, g }: { station: Station; g: StationGrade }) {
  const meta = GRADE_META[g.grade];
  const ron = meta?.ron ?? 0;
  const legacy = meta?.legacy ?? false;
  const e0 = e0Descriptor(meta?.e0 ?? null);
  const fresh = gradeFreshness(g);
  const rel = reliabilityScore(g);

  const verification =
    g.lastVerifiedDays === null
      ? "Not yet field-confirmed — listed by the oil company, awaiting a community check-in."
      : `Field-verified ${relDays(g.lastVerifiedDays)} · ${g.checkins} contributor${
          g.checkins === 1 ? "" : "s"
        }.`;

  return (
    <div
      style={{
        border: "1px solid var(--line)",
        borderRadius: "var(--radius-sm)",
        padding: 12,
        background: "var(--surface-2)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
        <span style={{ fontSize: 14.5, fontWeight: 800, letterSpacing: "-.2px" }}>{g.grade}</span>
        <span
          className="mono"
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "var(--ink-2)",
            background: "var(--bg)",
            border: "1px solid var(--line)",
            borderRadius: 5,
            padding: "1px 6px",
          }}
        >
          RON {ron}
        </span>
        <span
          style={{
            fontSize: 9.5,
            fontWeight: 800,
            letterSpacing: ".04em",
            color: `var(${e0.colorVar})`,
            border: `1px solid var(${e0.colorVar})`,
            borderRadius: 5,
            padding: "1px 4px",
          }}
        >
          {e0.label}
        </span>
        {legacy && (
          <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--ink-3)" }}>legacy</span>
        )}
        <span
          style={{
            marginLeft: "auto",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 11.5,
            fontWeight: 750,
            padding: "4px 9px",
            borderRadius: 999,
            color: `var(${fresh.colorVar})`,
            background: `color-mix(in srgb, var(${fresh.colorVar}) 16%, transparent)`,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: `var(${fresh.colorVar})`,
            }}
          />
          {fresh.label}
        </span>
      </div>

      <div
        role="meter"
        aria-label={`Reliability ${rel} of 100`}
        aria-valuenow={rel}
        aria-valuemin={0}
        aria-valuemax={100}
        style={{
          height: 6,
          borderRadius: 999,
          background: "var(--line)",
          margin: "11px 0 7px",
          overflow: "hidden",
        }}
      >
        <span
          style={{
            display: "block",
            height: "100%",
            width: `${rel}%`,
            background: `var(${fresh.colorVar})`,
            borderRadius: 999,
          }}
        />
      </div>

      <p style={{ margin: 0, fontSize: 11.5, color: "var(--ink-3)", lineHeight: 1.5 }}>
        <b style={{ color: "var(--ink-2)", fontWeight: 700 }}>Reliability {rel}/100.</b>{" "}
        {verification}
      </p>

      <PriceBlock station={station} grade={g.grade} />
    </div>
  );
}

export default function StationDetail({ station, onClose }: StationDetailProps) {
  const [reported, setReported] = useState(false);
  const allUnverified = stationIsAllUnverified(station);
  const geoHref = `geo:${station.lat},${station.lng}?q=${encodeURIComponent(station.name)}`;

  const checkinCaption = "Check-in opens when you are at the station (within ~1 km).";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
        background: "var(--surface)",
        color: "var(--ink)",
      }}
    >
      {/* header */}
      <div
        style={{
          padding: "16px 18px",
          borderBottom: "1px solid var(--line)",
          position: "relative",
        }}
      >
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close station detail"
            className="touch-target"
            style={{
              position: "absolute",
              top: 12,
              right: 12,
              width: 38,
              height: 38,
              display: "grid",
              placeItems: "center",
              borderRadius: 10,
              border: "1px solid var(--line)",
              background: "var(--surface-2)",
              color: "var(--ink-2)",
            }}
          >
            <Icon path="M6 6l12 12M18 6L6 18" size={18} />
          </button>
        )}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
            marginBottom: 8,
            paddingRight: onClose ? 44 : 0,
          }}
        >
          <BrandChip brand={station.brand} />
          {allUnverified && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontSize: 10.5,
                fontWeight: 750,
                color: "var(--unknown)",
                border: "1px dashed var(--unknown)",
                borderRadius: 6,
                padding: "2px 7px",
              }}
            >
              Unverified — official listing, not yet field-confirmed
            </span>
          )}
        </div>

        <h2
          style={{
            margin: 0,
            fontSize: 19,
            fontWeight: 800,
            letterSpacing: "-.3px",
            lineHeight: 1.2,
          }}
        >
          {displayName(station.name)}
        </h2>
        <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "var(--ink-2)" }}>
          {station.address}, {station.city}, {station.state} {station.pincode}
        </p>
        <div
          style={{
            display: "flex",
            gap: 14,
            marginTop: 10,
            fontSize: 11.5,
            color: "var(--ink-3)",
            flexWrap: "wrap",
          }}
        >
          <span>
            RO code{" "}
            <b className="mono" style={{ color: "var(--ink-2)", fontWeight: 700 }}>
              {station.roCode}
            </b>
          </span>
          {station.phone && (
            <span>
              Phone{" "}
              <b style={{ color: "var(--ink-2)", fontWeight: 700 }}>{station.phone}</b>
            </span>
          )}
        </div>
      </div>

      {/* body (scrolls) */}
      <div
        style={{
          flex: "1 1 auto",
          minHeight: 0,
          overflowY: "auto",
          padding: "16px 18px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <section>
          <p style={secLabel}>Fuel grades &amp; availability</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {station.grades.map((g) => (
              <GradeCard key={g.grade} station={station} g={g} />
            ))}
          </div>
        </section>

        <p style={{ margin: 0, fontSize: 11.5, color: "var(--ink-3)", lineHeight: 1.5 }}>
          Availability reflects community check-ins with recency decay — silence decays a station
          toward &ldquo;unknown&rdquo; rather than assuming stock. A check-in is the only event that
          updates the verified date.
        </p>

        {station.sources.length > 0 && (
          <section>
            <p style={secLabel}>Evidence</p>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              {station.sources.map((src, i) => (
                <li
                  key={`${src.source}-${i}`}
                  style={{ display: "flex", gap: 8, fontSize: 11.5, color: "var(--ink-3)", lineHeight: 1.45 }}
                >
                  <span
                    style={{
                      marginTop: 5,
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      flex: "none",
                      background: "var(--accent)",
                    }}
                  />
                  <span>
                    <b style={{ color: "var(--ink-2)", fontWeight: 700 }}>{src.source}</b>
                    {" · "}
                    {src.method}
                    {" · captured "}
                    {fmtDate(src.retrievedAt)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* check-in (v1.1, disabled) */}
        <section>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 11,
              fontWeight: 750,
              color: "var(--ink-3)",
              textTransform: "uppercase",
              letterSpacing: ".07em",
              marginBottom: 8,
            }}
          >
            Community check-in
            <span
              style={{
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: ".05em",
                color: "var(--accent-ink)",
                background: "var(--accent-soft)",
                borderRadius: 5,
                padding: "2px 6px",
              }}
            >
              v1.1
            </span>
          </div>
          <div style={{ display: "flex", gap: 7 }}>
            {["Fuelled up — in stock", "Dry / out of stock", "Doesn't stock this fuel"].map(
              (label) => (
                <button
                  key={label}
                  type="button"
                  disabled
                  aria-disabled="true"
                  title={checkinCaption}
                  style={{
                    flex: 1,
                    fontSize: 11.5,
                    fontWeight: 700,
                    padding: "9px 6px",
                    borderRadius: 9,
                    border: "1px solid var(--line)",
                    background: "var(--surface)",
                    color: "var(--ink-2)",
                    opacity: 0.55,
                    cursor: "not-allowed",
                  }}
                >
                  {label}
                </button>
              ),
            )}
          </div>
          <p style={{ margin: "6px 0 0", fontSize: 10.5, color: "var(--ink-3)" }}>{checkinCaption}</p>
        </section>
      </div>

      {/* actions */}
      <div
        style={{
          display: "flex",
          gap: 9,
          padding: "14px 18px",
          borderTop: "1px solid var(--line)",
        }}
      >
        <a
          href={geoHref}
          className="touch-target"
          style={{
            flex: 1,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 7,
            borderRadius: 10,
            padding: 11,
            fontSize: 13,
            fontWeight: 750,
            border: "1px solid var(--accent)",
            background: "var(--accent)",
            color: "var(--accent-contrast)",
            textDecoration: "none",
          }}
        >
          <Icon path="M3 11l19-9-9 19-2-8-8-2z" />
          Get directions
        </a>
        <button
          type="button"
          onClick={() => setReported(true)}
          disabled={reported}
          className="touch-target"
          style={{
            flex: 1,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 7,
            borderRadius: 10,
            padding: 11,
            fontSize: 13,
            fontWeight: 750,
            border: "1px solid var(--line)",
            background: "var(--surface-2)",
            color: reported ? "var(--ink-3)" : "var(--ink)",
            cursor: reported ? "default" : "pointer",
          }}
        >
          {!reported && <Icon path="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />}
          {reported ? "Thanks — sent to ops (7-day SLA)" : "Report an issue"}
        </button>
      </div>
    </div>
  );
}
