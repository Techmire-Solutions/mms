import { test, expect } from "@playwright/test";

/**
 * Apex navigation smoke. Authenticated tenant settings are covered in
 * `onboarding-login.spec.ts` after onboard.
 */
test.describe("Tenant Navigation and Module Tab Switching E2E Flow", { tag: "@smoke" }, () => {
  test("should render platform home page and expose a sign-in path", async ({ page }) => {
    await page.goto("/");
    // Wait for the SPA boot + platform auth API call to settle before asserting.
    await page.waitForLoadState("networkidle");

    const pageTitle = await page.title();
    expect(pageTitle).toBeDefined();
    expect(pageTitle.length).toBeGreaterThan(0);

    // First-run setup (`#platform-setup-email`) or sign-in (`#platform-email`) —
    // either is a valid apex landing. We scope to the two static input IDs to avoid
    // matching invisible nav/header links that contain "login" in their href.
    const setupOrLogin = page.locator("#platform-setup-email, #platform-email");
    await expect(setupOrLogin.first()).toBeVisible({ timeout: 20_000 });
  });
});
