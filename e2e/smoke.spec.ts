import { test, expect } from "@playwright/test";

// These run against the booted app (no DB needed for these routes).
test("health endpoint is ok", async ({ request }) => {
  const res = await request.get("/healthz");
  expect(res.status()).toBe(200);
  expect((await res.json()).status).toBe("ok");
});

test("sign-in page renders with labeled fields and no AI wording", async ({ page }) => {
  await page.goto("/sign-in");
  await expect(page.locator("h1")).toBeVisible();
  await expect(page.getByLabel(/username|email/i)).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/\bAI\b/);
});

test("unknown route returns 404", async ({ request }) => {
  const res = await request.get("/nope-not-here");
  expect(res.status()).toBe(404);
});
