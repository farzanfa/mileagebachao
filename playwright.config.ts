// Playwright configuration (BUILD-CONTRACT §11 TESTS).
//
// The smoke suite (`e2e/smoke.spec.ts`) boots the real app and asserts the two core
// routes render. Per contract §2 the app MUST run with NO database and NO secrets, so
// the managed web server forces DATABASE_URL empty (reads fall back to the committed
// seed JSON) and leaves the map style URL empty (the map renders its CSP-safe
// "configure map" placeholder rather than fetching external tiles). This keeps the
// e2e run fully self-contained and reproducible in CI.

import { defineConfig, devices } from "@playwright/test";

const PORT = 3000;
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    viewport: { width: 1280, height: 800 },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // Build + start the production server. Building here (rather than `next dev`) exercises
  // the same no-DB/no-secrets build path the contract mandates. `reuseExistingServer`
  // lets a locally-running dev server be reused; CI always builds fresh.
  webServer: {
    command: "npm run build && npm run start",
    url: BASE_URL,
    timeout: 300_000,
    reuseExistingServer: !process.env.CI,
    env: {
      DATABASE_URL: "",
      NEXT_PUBLIC_SITE_URL: BASE_URL,
      NEXT_PUBLIC_MAP_STYLE_URL: "",
    },
  },
});
