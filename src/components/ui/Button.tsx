// Generic button / link atom (BUILD-CONTRACT §8 "ui/Button generic").
// Renders a <button> normally, or an <a> when `href` is provided (so it can be a
// nav CTA or a call/navigate action). Token colours are applied via Tailwind
// arbitrary utilities so hover states are class-based (never overridden by inline
// style specificity). Shared component: usable in both server and client trees.

import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md";

interface CommonProps {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  className?: string;
  children: ReactNode;
}

type ButtonElementProps = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> & {
    href?: undefined;
  };
type AnchorElementProps = CommonProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "className" | "children"> & {
    href: string;
  };

export type ButtonProps = ButtonElementProps | AnchorElementProps;

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-[10px] border font-[750] " +
  "no-underline transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-[var(--accent)] text-[var(--accent-contrast)] border-[var(--accent)] " +
    "hover:bg-[var(--accent-ink)] hover:border-[var(--accent-ink)]",
  secondary:
    "bg-[var(--surface-2)] text-[var(--ink)] border-[var(--line)] hover:border-[var(--line-strong)]",
  ghost:
    "bg-transparent text-[var(--ink-2)] border-[var(--line)] hover:border-[var(--line-strong)] hover:text-[var(--ink)]",
};

const SIZES: Record<Size, string> = {
  md: "min-h-[44px] px-4 text-[13px]",
  sm: "min-h-[44px] px-3 text-[12.5px]",
};

export function Button(props: ButtonProps) {
  const { variant = "secondary", size = "md", fullWidth, className, children, ...rest } = props;
  const cls = [BASE, VARIANTS[variant], SIZES[size], fullWidth ? "w-full" : "", className]
    .filter(Boolean)
    .join(" ");

  if (props.href !== undefined) {
    const anchorRest = rest as Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "className" | "children">;
    return (
      <a className={cls} {...anchorRest}>
        {children}
      </a>
    );
  }

  const btnRest = rest as Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children">;
  return (
    <button className={cls} {...btnRest} type={btnRest.type ?? "button"}>
      {children}
    </button>
  );
}

export default Button;
