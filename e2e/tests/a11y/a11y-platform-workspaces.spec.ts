import { expect, test, type Page } from "@playwright/test";
import { assertNoSeriousA11yViolations } from "../../helpers/a11y.js";
import {
  RESPONSIVE_VIEWPORTS,
  waitForAppShellReady,
  waitForToastsToClear,
} from "../../helpers/responsive.js";
import { ensureE2ePlatformAdmin } from "../../helpers/platformAdminSeeder.js";

process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "e2e-test-jwt-secret-key-at-least-32-chars-long";

const platformEmail = `platform-a11y-ws-${Date.now()}@test.com`;
const platformPassword = "Pa$$w0rd123";

const AUDIT_VIEWPORTS = RESPONSIVE_VIEWPORTS.filter(
  (viewport) => viewport.width === 375 || viewport.width === 1440,
);

async function signInPlatformAdmin(page: Page): Promise<void> {
  const platformLanding = page
    .getByRole("heading", { name: /Dashboard|Welcome back|Workspaces|Madrasas/i })
    .or(page.locator('a[href="/platform/workspaces"]'))
    .or(page.locator('a[href="/onboarding"]'));

  await page.goto("/platform/login");
  await page.waitForLoadState("domcontentloaded");

  const setupEmailInput = page.locator("#platform-setup-email");
  const platformEmailInput = page.locator("#platform-email");
  const retryBtn = page.getByRole("button", { name: /Try again/i });

  await expect
    .poll(
      async () => {
        if (await retryBtn.isVisible().catch(() => false)) {
          await retryBtn.click().catch(() => undefined);
        }
        if (
          await platformLanding
            .first()
            .isVisible()
            .catch(() => false)
        )
          return true;
        if (await setupEmailInput.isVisible().catch(() => false)) return true;
        if (await platformEmailInput.isVisible().catch(() => false)) return true;
        return false;
      },
      { timeout: 45_000, intervals: [500, 1000, 2000] },
    )
    .toBe(true);

  if (
    await platformLanding
      .first()
      .isVisible()
      .catch(() => false)
  ) {
    return;
  }

  if (await setupEmailInput.isVisible().catch(() => false)) {
    await page.locator("#platform-setup-name").fill("Platform A11y Admin");
    await setupEmailInput.fill(platformEmail);
    await page.locator("#platform-setup-password").fill(platformPassword);
    await page.locator('button[type="submit"]').click();
  } else if (await platformEmailInput.isVisible().catch(() => false)) {
    await platformEmailInput.fill(platformEmail);
    await page.locator("#platform-password").fill(platformPassword);
    await page.locator('button[type="submit"]').click();
  }

  await expect(platformLanding.first()).toBeVisible({ timeout: 45_000 });
}

async function gotoWorkspacesAndSettle(page: Page): Promise<void> {
  await page.goto("/platform/workspaces");
  await page.waitForLoadState("domcontentloaded");
  await waitForAppShellReady(page);
  await page
    .locator("#main-content")
    .first()
    .waitFor({ state: "visible", timeout: 20_000 })
    .catch(() => undefined);
  await waitForToastsToClear(page).catch(() => undefined);
  await page
    .locator('[aria-busy="true"]')
    .waitFor({ state: "hidden", timeout: 15_000 })
    .catch(() => undefined);
  await page.waitForLoadState("networkidle").catch(() => undefined);
}

/**
 * Apex platform workspaces directory — axe smoke at 375 / 1440 (LTR only; English lock).
 */
test.describe("platform workspaces accessibility smoke @smoke", () => {
  test("platform workspaces directory passes axe at 375 and 1440 (ltr)", async ({ page }) => {
    test.setTimeout(180_000);

    await test.step("Seed and sign in platform admin", async () => {
      ensureE2ePlatformAdmin(platformEmail, platformPassword);
      await signInPlatformAdmin(page);
    });

    for (const viewport of AUDIT_VIEWPORTS) {
      await test.step(`Audit workspaces @ ${viewport.width}px (ltr)`, async () => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await gotoWorkspacesAndSettle(page);
        await assertNoSeriousA11yViolations(page, {
          context: `platform workspaces @ ${viewport.width}px (ltr)`,
          // Plan ready surface: directory content, not apex sidebar chrome.
          include: ["#main-content"],
        });
      });
    }
  });
});
