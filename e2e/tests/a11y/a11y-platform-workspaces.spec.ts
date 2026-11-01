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

/**
 * Every console route the 2026-10-31 review captured. The gate used to audit
 * only `/workspaces` and `/dashboard`, which is how the Design System subtitle
 * contrast defect escaped it. Keep this list in step with the platform sidebar.
 */
const PLATFORM_ROUTES = [
  { name: "dashboard", path: "/platform/dashboard" },
  { name: "workspaces", path: "/platform/workspaces" },
  { name: "reports", path: "/platform/reports" },
  { name: "consolidation", path: "/platform/consolidation" },
  { name: "users", path: "/platform/users" },
  { name: "settings", path: "/platform/settings" },
  { name: "activity logs", path: "/platform/activity-logs" },
  { name: "system", path: "/platform/system" },
  { name: "design system", path: "/platform/design-system" },
] as const;

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

async function gotoPlatformPageAndSettle(page: Page, path: string): Promise<void> {
  await page.goto(path);
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
 * Apex platform console — full-page axe at 375 / 1440 (LTR, English lock).
 *
 * Contexts must keep `reducedMotion` from the project config (`reduce`): the
 * directory cards fade in through a framer-motion opacity transition, and an
 * audit that samples mid-animation reports blended colours as contrast
 * failures (17–18 false positives on `/platform/users` at 375 when motion ran).
 */
test.describe("platform console accessibility smoke @smoke", () => {
  for (const route of PLATFORM_ROUTES) {
    test(`${route.name} passes full-page axe at 375 and 1440 (ltr)`, async ({ page }) => {
      test.setTimeout(180_000);

      await test.step("Seed and sign in platform admin", async () => {
        ensureE2ePlatformAdmin(platformEmail, platformPassword);
        await signInPlatformAdmin(page);
      });

      for (const viewport of AUDIT_VIEWPORTS) {
        await test.step(`Audit ${route.name} @ ${viewport.width}px (ltr)`, async () => {
          await page.setViewportSize({ width: viewport.width, height: viewport.height });
          await gotoPlatformPageAndSettle(page, route.path);
          // Full page: the header/sidebar are part of the shell contract and
          // previously escaped a main-content-only sweep.
          await assertNoSeriousA11yViolations(page, {
            context: `platform ${route.name} @ ${viewport.width}px (ltr)`,
          });
        });
      }
    });
  }
});

/**
 * The one platform contrast defect found so far lived in the Design System
 * gallery's dark render, and the light-only sweep could not see it.
 */
test.describe("platform design system dark accessibility @smoke", () => {
  test.use({ colorScheme: "dark" });

  test("design system gallery passes full-page axe in dark at 1440 (ltr)", async ({ page }) => {
    test.setTimeout(180_000);

    await test.step("Seed and sign in platform admin", async () => {
      ensureE2ePlatformAdmin(platformEmail, platformPassword);
      await signInPlatformAdmin(page);
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoPlatformPageAndSettle(page, "/platform/design-system");
    await assertNoSeriousA11yViolations(page, {
      context: "platform design system @ 1440px (ltr, dark)",
    });
  });
});
