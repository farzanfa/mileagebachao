// Apple touch icon (iOS home screen / Safari), generated at build time by next/og.
// Full-bleed Mileage Green; iOS applies its own corner mask. Same gauge geometry
// as icon.svg, scaled to 180px with strokes sized for the larger canvas.

import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0F7A3D",
        }}
      >
        <svg width="150" height="150" viewBox="0 0 48 48">
          <path
            d="M11 31.5 A14 14 0 1 1 37 31.5"
            fill="none"
            stroke="#ffffff"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <line
            x1="24"
            y1="29.5"
            x2="33.8"
            y2="17.2"
            stroke="#E9A115"
            strokeWidth="4.2"
            strokeLinecap="round"
          />
          <circle cx="24" cy="29.5" r="3.6" fill="#ffffff" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
