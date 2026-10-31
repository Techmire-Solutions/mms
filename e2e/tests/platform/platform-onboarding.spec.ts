import { test, expect } from "@playwright/test";
import {
  resetPlatformUsers,
  ensureE2ePlatformAdmin,
  setTenantAdminPassword,
} from "../../helpers/tenantBootstrap.js";

process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "e2e-test-jwt-secret-key-at-least-32-chars-long";

test.describe.serial(
  "Platform Onboarding and Tenant Login E2E Flow",
  { tag: "@local-only" },
  () => {
    const subdomain = `testmadrasa${Date.now()}`;
    const adminEmail = `admin@${subdomain}.com`;
    const adminPassword = "Madrasa@1234";
    const changedAdminPassword = "Madrasa@5678";
    const platformEmail = "platform@test.com";
    const platformPassword = "Pa$$w0rd123";

    test.beforeAll(() => {
      resetPlatformUsers();
      ensureE2ePlatformAdmin(platformEmail, platformPassword);
    });

    test("should setup platform, onboard a new madrasa, force first password change, and load tenant dashboard", async ({
      page,
    }) => {
      test.setTimeout(120_000);
      const browserFailures: string[] = [];

      page.on("console", (msg) => {
        if (msg.type() === "error" || msg.text().includes("error")) {
          console.log(`[BROWSER CONSOLE ERROR] ${msg.text()}`);
        }
      });
      page.on("pageerror", (err) => {
        browserFailures.push(`Unhandled browser exception: ${err.message}`);
      });
      page.on("response", (response) => {
        if (response.status() >= 500) {
          const url = response.url();
          if (
            response.status() === 502 &&
            (url.includes("/api/platform/auth/setup/status") ||
              url.includes("/api/public/deployment-config"))
          ) {
            return;
          }
          browserFailures.push(`HTTP ${response.status()}: ${response.request().method()} ${url}`);
        }
      });

      // 1. Navigate to platform landing page
      await page.goto("/");
      await page.waitForLoadState("domcontentloaded");

      // 2. Perform first-run platform setup or sign in if already initialized
      const setupEmailInput = page.locator("#platform-setup-email");
      const signInEmailInput = page.locator("#platform-email");
      const platformConsoleLanding = page
        .getByRole("heading", { name: /Dashboard|Welcome back/i })
        .or(page.locator('a[href="/onboarding"]'));

      await setupEmailInput
        .or(signInEmailInput)
        .or(platformConsoleLanding)
        .first()
        .waitFor({ state: "visible", timeout: 25_000 });

      if (await setupEmailInput.isVisible()) {
        await page.fill("#platform-setup-name", "Platform Admin");
        await setupEmailInput.fill(platformEmail);
        await page.fill("#platform-setup-password", platformPassword);
        await page.click('button[type="submit"]');
        await platformConsoleLanding
          .or(signInEmailInput)
          .first()
          .waitFor({ state: "visible", timeout: 25_000 });
      }

      if (await signInEmailInput.isVisible()) {
        await signInEmailInput.fill(platformEmail);
        await page.fill("#platform-password", platformPassword);
        await page.click('button[type="submit"]');
      }

      await expect(platformConsoleLanding.first()).toBeVisible({ timeout: 20_000 });

      await expect(
        page
          .getByRole("link", { name: /Create New Madrasa/i })
          .or(page.locator('a[href="/onboarding"]'))
          .first(),
      ).toBeVisible();

      // 3. Open Onboarding Wizard & Fill Step 1
      await page.locator('a[href="/onboarding"]:visible').first().click();
      await page.waitForURL("**/onboarding");
      await page.waitForSelector("#wizard-step-title");
      await expect(page.locator("#wizard-step-title")).toContainText("Organization details");

      await page.fill("#onboarding-name", "Test Madrasa");
      await page.fill("#onboarding-subdomain", subdomain);
      await expect(page.locator("text=Your URL:")).toBeVisible();

      // Step 2 Modules
      await page.click('button:has-text("Continue")');
      await expect(page.locator("#wizard-step-title")).toContainText("Modules");

      // Step 3 Structure (keep recommended)
      await page.click('button:has-text("Continue")');
      await expect(page.locator("#wizard-step-title")).toContainText("Organization structure");

      // Step 4 Admin
      await page.click('button:has-text("Continue")');
      await page.waitForSelector("#firstName");

      await page.fill("#firstName", "Test");
      await page.fill("#lastName", "Admin");
      await page.fill("#email", adminEmail);
      if (
        await page
          .locator("#password")
          .isVisible()
          .catch(() => false)
      ) {
        await page.fill("#password", adminPassword);
        await page.fill("#confirmPassword", adminPassword);
      }
      await page.check("#terms");

      // Step 5 Complete + create
      await page.click('button:has-text("Continue")');
      await expect(page.locator("#wizard-step-title")).toContainText("Review and create");
      const platformPasswordInput = page.locator("#onboarding-platform-password");
      if (await platformPasswordInput.isVisible().catch(() => false)) {
        await platformPasswordInput.fill(platformPassword);
      }
      await page.click('button:has-text("Create workspace")');
      await page.waitForURL((url) => !url.pathname.includes("/onboarding"), { timeout: 45_000 });
      await expect(platformConsoleLanding.first()).toBeVisible({ timeout: 25_000 });

      setTenantAdminPassword(subdomain, adminEmail, adminPassword);

      // 5. Navigate to tenant login page & login with temporary password
      const tenantLoginUrl = `http://${subdomain}.localhost:5173/login`;
      await page.goto(tenantLoginUrl);
      await page.waitForLoadState("domcontentloaded");

      await page.fill('input[name="email"]', adminEmail);
      await page.fill('input[name="password"]', adminPassword);
      await page.click('button[type="submit"]');

      // 6. Complete mandatory temporary password change
      await page.waitForURL(`http://${subdomain}.localhost:5173/force-password-change`);
      await expect(page.locator("h1")).toContainText(/temporary password|Change your/i, {
        timeout: 20_000,
      });
      await page.fill("#current-password", adminPassword);
      await page.fill("#new-password", changedAdminPassword);
      await page.fill("#confirm-password", changedAdminPassword);
      await page.click('button[type="submit"]');

      // 7. Login with permanent credentials and verify welcome banner
      await page.waitForURL(`http://${subdomain}.localhost:5173/login`);
      await page.fill('input[name="email"]', adminEmail);
      await page.fill('input[name="password"]', changedAdminPassword);
      await page.click('button[type="submit"]');

      const institutionHeading = page.locator("h1", {
        hasText: /Institution Profile|Complete Institution/i,
      });
      const dashboardHeading = page.locator("h1", { hasText: /Assalamu Alaikum/i });
      await expect(institutionHeading.or(dashboardHeading).first()).toBeVisible({
        timeout: 30_000,
      });

      if (await institutionHeading.isVisible().catch(() => false)) {
        await page.fill("#setup-tagline", "Learn with excellence");
        await page.fill("#setup-email", adminEmail);
        await page.fill("#setup-phone", "03001234567");
        await page.fill("#setup-addressLine1", "123 Test Lane");
        await page.fill("#setup-city", "London");
        await page.fill("#setup-postalCode", "E1 6AN");
        await page.fill("#setup-country", "United Kingdom");
        await page.click('button[type="submit"]');
      }

      await page.waitForURL(`http://${subdomain}.localhost:5173/`);
      await page.waitForLoadState("domcontentloaded");
      await expect(page.locator("h1")).toContainText(/Assalamu Alaikum/i, {
        timeout: 20_000,
      });

      expect(browserFailures, browserFailures.join("\n")).toEqual([]);
    });
  },
);
