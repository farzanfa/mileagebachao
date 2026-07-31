// Playwright smoke test (BUILD-CONTRACT §11 TESTS). Runs against the app started by
// playwright.config.ts (webServer). Verifies the launch-critical surfaces render.
// Run with: npm run test:e2e  (installs browsers first: npx playwright install --with-deps)

import { test, expect } from "@playwright/test";

test("homepage is the map with search and add-a-pump", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/OctaneFinder/i);
  await expect(page.getByRole("searchbox").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /add a pump/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /find pumps near me/i })).toBeVisible();
});

test("GPS locate shows the nearest-pumps panel", async ({ browser }) => {
  const context = await browser.newContext({
    geolocation: { latitude: 9.97, longitude: 76.32 }, // Kochi
    permissions: ["geolocation"],
  });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByRole("button", { name: /find pumps near me/i }).click();
  await expect(page.getByText(/nearest pumps to you/i)).toBeVisible();
  await expect(page.getByText(/vytilla/i).first()).toBeVisible();
  await context.close();
});

test("search finds a Kochi pump and shows its card", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("searchbox").first().fill("kochi");
  await expect(page.getByText(/Vytilla|Thevara|Kaloor|Padivattom/i).first()).toBeVisible();
});

test("old /map URL redirects home", async ({ page }) => {
  await page.goto("/map");
  await expect(page).toHaveURL(/\/$/);
});

test("a city page is server-rendered with stations", async ({ page }) => {
  await page.goto("/kochi");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText(/XP100|Speed 100|poWer 100/i).first()).toBeVisible();
});

test("health endpoint responds ok", async ({ request }) => {
  const res = await request.get("/api/v1/health");
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.data.status).toBe("ok");
});
