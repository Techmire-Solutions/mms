import { expect, test } from "@playwright/test";
import { loginTenant } from "../../helpers/moduleTiers.js";
import {
  bootstrapAuthenticatedTenant,
  ensureE2ePlatformAdmin,
} from "../../helpers/tenantBootstrap.js";

process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "e2e-test-jwt-secret-key-at-least-32-chars-long";

const subdomain = `setsticky${Date.now()}`;
const tenantOrigin = `http://${subdomain}.localhost:5173`;
const adminEmail = `admin@${subdomain}.com`;
const temporaryPassword = "Madrasa@1234";
const permanentPassword = "Madrasa@5678";
const platformEmail = `platform-setsticky-${Date.now()}@test.com`;
const platformPassword = "Pa$$w0rd123";

test.describe("General settings action bar", { tag: "@local-only" }, () => {
  test("stays visible while scrolling the long General panel", async ({ page }) => {
    test.setTimeout(180_000);
    ensureE2ePlatformAdmin(platformEmail, platformPassword);
    await bootstrapAuthenticatedTenant(page, {
      subdomain,
      tenantOrigin,
      adminEmail,
      adminPassword: temporaryPassword,
      changedAdminPassword: permanentPassword,
      platformEmail,
      platformPassword,
    });
    await loginTenant(page, tenantOrigin, adminEmail, permanentPassword);

    await page.goto(`${tenantOrigin}/settings`);
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("#main-content")).toBeVisible({ timeout: 25_000 });

    const save = page.getByRole("button", { name: /Save Settings/i }).first();
    await expect(save).toBeVisible({ timeout: 20_000 });
    const before = await save.boundingBox();
    expect(before).toBeTruthy();

    await page.evaluate(() => window.scrollTo(0, 900));
    await expect.poll(() => page.evaluate(() => Math.round(window.scrollY))).toBeGreaterThan(0);
    const after = await save.boundingBox();
    expect(after).toBeTruthy();
    // The header is ~64px; a non-sticky button would be far above the viewport.
    expect(after!.y).toBeGreaterThan(0);
    expect(after!.y).toBeLessThan(220);

    const settingsNav = page
      .locator("#main-content nav")
      .filter({ has: page.getByRole("button", { name: /General/i }) })
      .first();
    await expect(settingsNav).toBeVisible();
    const navAfter = await settingsNav.boundingBox();
    expect(navAfter).toBeTruthy();
    expect(navAfter!.y).toBeGreaterThan(0);
    expect(navAfter!.y).toBeLessThan(220);
  });
});
