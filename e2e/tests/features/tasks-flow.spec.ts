import { test, expect } from "@playwright/test";

/**
 * Lightweight unauthenticated smoke — authenticated tasks tiers are covered in
 * `tenant-operations-flow.spec.ts` (operational flow suite).
 */
test.describe("Tasks Module E2E Flow", { tag: "@smoke" }, () => {
  test("unauthenticated /tasks redirects away from tenant work shell", async ({ page }) => {
    await page.goto("/tasks");
    await page.waitForLoadState("domcontentloaded");

    // Apex or login gate — must not render authenticated tasks Work panel.
    await expect(page.locator("#tasks-tab-panel-work")).toHaveCount(0);
    const title = await page.title();
    expect(title).toMatch(/MMS|Madrasa|Platform|Login|Sign/i);
  });
});
