// Social share image (og:image / twitter:image), generated at build time by next/og.
// Brand: Mileage Green field, gauge mark with the amber needle, wordmark + slogan.
// Satori rules: every multi-child element needs display:flex.

import { ImageResponse } from "next/og";

export const alt =
  "MileageBachao — Mileage bachao, E0 bharao. Map of India's ethanol-free 100-octane petrol pumps.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          background: "#0F7A3D",
          padding: "80px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "28px" }}>
          <svg width="120" height="120" viewBox="0 0 48 48">
            <rect width="48" height="48" rx="12" fill="#0A5A2C" />
            <path
              d="M11.5 31 A13.5 13.5 0 1 1 36.5 31"
              fill="none"
              stroke="#ffffff"
              strokeWidth="3.4"
              strokeLinecap="round"
            />
            <line
              x1="24"
              y1="29.5"
              x2="33.4"
              y2="17.6"
              stroke="#E9A115"
              strokeWidth="3.6"
              strokeLinecap="round"
            />
            <circle cx="24" cy="29.5" r="3.1" fill="#ffffff" />
          </svg>
          <div style={{ display: "flex", fontSize: 84, fontWeight: 800, color: "#ffffff" }}>
            <span>Mileage</span>
            <span style={{ color: "#BFE8CD" }}>Bachao</span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            marginTop: "44px",
            fontSize: 44,
            fontWeight: 700,
            color: "#ffffff",
          }}
        >
          “Mileage bachao, E0 bharao.”
        </div>
        <div
          style={{
            display: "flex",
            marginTop: "18px",
            fontSize: 27,
            color: "rgba(255,255,255,0.85)",
          }}
        >
          The map of India’s ethanol-free (E0), 100-octane petrol pumps — XP100 · poWer 100 · Speed
          100
        </div>

        <div
          style={{
            display: "flex",
            marginTop: "56px",
            alignItems: "center",
            gap: "14px",
          }}
        >
          <div
            style={{
              display: "flex",
              background: "#E9A115",
              color: "#101819",
              fontSize: 22,
              fontWeight: 700,
              padding: "10px 22px",
              borderRadius: "999px",
            }}
          >
            Find a pump near you
          </div>
          <div
            style={{
              display: "flex",
              border: "2px solid rgba(255,255,255,0.5)",
              color: "#ffffff",
              fontSize: 22,
              fontWeight: 700,
              padding: "8px 22px",
              borderRadius: "999px",
            }}
          >
            + Add a pump you found
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
