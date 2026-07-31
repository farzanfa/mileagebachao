// Vitest configuration (BUILD-CONTRACT §11 TESTS).
//
// - Resolves the `@/*` path alias to `src/*`, matching tsconfig.json so unit tests
//   import contract modules exactly as application code does (`@/lib/...`).
// - Runs in the Node environment: every unit here is pure logic or a route handler
//   exercised via the Web `Request`/`Response` globals — no DOM is required, so we
//   avoid the jsdom overhead. Individual files may opt into jsdom with a
//   `// @vitest-environment jsdom` docblock if that ever changes.
// - Scopes discovery to `tests/**` and explicitly excludes `e2e/**` so Playwright's
//   `*.spec.ts` files are never picked up by Vitest (they run under `test:e2e`).
// - @vitejs/plugin-react is enabled so any future component-level test transforms JSX
//   with the same pipeline as the app.

import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, configDefaults } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    globals: false,
    include: ["tests/**/*.test.ts"],
    exclude: [...configDefaults.exclude, "e2e/**"],
    clearMocks: true,
    restoreMocks: true,
  },
});
