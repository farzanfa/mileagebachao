// MileageBachao brand mark: a mileage gauge with the needle pinned high.
// Green = economy ("go"); the amber needle is the protest spark. Pure SVG,
// server-safe, sized via the `size` prop. Wordmark: "Mileage" in ink,
// "Bachao" in Mileage Green (see Header / SimpleMapHome).

export default function BrandMark({ size = 34 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      aria-hidden="true"
      focusable="false"
      style={{ display: "block", flex: "none" }}
    >
      <rect width="48" height="48" rx="12" fill="var(--accent)" />
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
        stroke="var(--brand-amber)"
        strokeWidth="3.6"
        strokeLinecap="round"
      />
      <circle cx="24" cy="29.5" r="3.1" fill="#ffffff" />
    </svg>
  );
}
