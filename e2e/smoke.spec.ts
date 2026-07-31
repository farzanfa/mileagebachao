// Playwright smoke test (BUILD-CONTRACT §11 TESTS). Runs against the app started by
// playwright.config.ts (webServer). Verifies the two launch-critical surfaces render.
// Run with: npm run test:e2e  (installs browsers first: npx playwright install --with-deps)

import { test, expect } from "@playwright/test";

test("landing page loads and links to the map", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/OctaneFinder/i);
  // E0-first positioning is present somewhere on the page.
  await expect(page.getByText(/ethanol-free|E0/i).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /map/i }).first()).toBeVisible();
});

test("map app view renders the shell", async ({ page }) => {
  await page.goto("/map");
  // The search box from the Filters panel is the most stable anchor.
  await expect(page.getByRole("searchbox").or(page.getByPlaceholder(/city|pincode/i)).first()).toBeVisible();
});

test("a city page is server-rendered with stations", async ({ page }) => {
  await page.goto("/delhi");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText(/XP100|Speed 100|poWer 100/i).first()).toBeVisible();
});

test("health endpoint responds ok", async ({ request }) => {
  const res = await request.get("/api/v1/health");
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.data.status).toBe("ok");
});
