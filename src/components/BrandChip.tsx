// Neutral OMC brand text chip (BUILD-CONTRACT §8, UX §4.2.5).
// We render NO OMC logos and NO dealer names — only a neutral coloured dot plus the
// brand text. Brand id -> display name / colour token are hard-mapped locally so this
// component stays self-contained (it does not pull the seed dataset into any bundle).
// Ported from the prototype `.bchip` rule.

import type { Brand } from "@/lib/types";

const BRAND_NAME: Record<Brand, string> = {
  IOCL: "IndianOil",
  HPCL: "HPCL",
  BPCL: "BPCL",
};

const BRAND_COLOR: Record<Brand, string> = {
  IOCL: "--brand-iocl",
  HPCL: "--brand-hpcl",
  BPCL: "--brand-bpcl",
};

export function BrandChip({
  brand,
  withLabel = true,
  className,
}: {
  brand: Brand;
  withLabel?: boolean;
  className?: string;
}) {
  const name = BRAND_NAME[brand];
  const cls = [
    "inline-flex items-center gap-[6px] text-[11px] font-extrabold tracking-[0.02em] text-[var(--ink-2)]",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={cls}>
      <span
        aria-hidden
        className="h-[10px] w-[10px] shrink-0 rounded-full"
        style={{ background: `var(${BRAND_COLOR[brand]})` }}
      />
      {withLabel ? <span>{name}</span> : <span className="sr-only">{name}</span>}
    </span>
  );
}

export default BrandChip;
