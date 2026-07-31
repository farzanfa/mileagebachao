import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

// Flat config bridging eslint-config-next (BUILD-CONTRACT §11 FOUNDATION).
// @eslint/eslintrc ships as a transitive dependency of eslint@8, so no extra dep is added.
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "coverage/**",
      "pipeline/**",
      "playwright-report/**",
    ],
  },
];

export default eslintConfig;
