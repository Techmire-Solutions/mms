import { test, expect } from "@playwright/test";

/**
 * Lightweight unauthenticated smoke — authenticated messaging tiers are covered in
 * `onboarding-login.spec.ts` (serial suite after tenant onboard).
 */
test.describe("Messaging Module E2E Flow", { tag: "@smoke" }, () => {
  test("unauthenticated /messaging redirects away from tenant work shell", async ({ page }) => {
    await page.goto("/messaging");
    await page.waitForLoadState("domcontentloaded");

    // Apex or login gate — must not render authenticated messaging Work panel.
    await expect(page.locator("#messaging-tab-panel-work")).toHaveCount(0);
    const title = await page.title();
    expect(title).toMatch(/MMS|Madrasa|Platform|Login|Sign/i);
  });
});
