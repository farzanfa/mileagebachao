import type { Config } from "tailwindcss";

// Design tokens live as CSS custom properties in src/styles/tokens.css (BUILD-CONTRACT §9).
// Tailwind handles layout / spacing / type; token colors are applied via CSS vars
// (e.g. style={{ color: "var(--ink)" }}) or small utility classes. Dark mode is driven
// by the [data-theme="dark"] attribute (set by ThemeToggle) as well as prefers-color-scheme.
const config: Config = {
  darkMode: ['selector', '[data-theme="dark"]'],
  content: [
    "./src/**/*.{ts,tsx,js,jsx,mdx}",
    "./src/app/**/*.{ts,tsx,js,jsx,mdx}",
    "./src/components/**/*.{ts,tsx,js,jsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "system-ui",
          "Roboto",
          "sans-serif",
        ],
        mono: [
          "ui-monospace",
          '"SF Mono"',
          "Menlo",
          "Consolas",
          "monospace",
        ],
      },
      borderRadius: {
        token: "var(--radius)",
        "token-sm": "var(--radius-sm)",
      },
      boxShadow: {
        token: "var(--shadow)",
        "token-lg": "var(--shadow-lg)",
      },
    },
  },
  plugins: [],
};

export default config;
