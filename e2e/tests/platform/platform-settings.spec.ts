import { expect, test, type Page } from "@playwright/test";
import { ensureE2ePlatformAdmin } from "../../helpers/tenantBootstrap.js";

process.env.NODE_ENV = process.env.NODE_ENV || "test";

/**
 * Platform settings white-label smoke flow.
 *
 * SAFETY: local-only (tagged `@local-only`), non-destructive platform-admin seed,
 * and branding is captured before the test and restored in `finally`. No tenant
 * data, users, or workspaces are created or deleted.
 */

const platformEmail = "platform-e2e-settings@test.com";
const platformPassword = "Pa$$w0rd123";
const temporaryProductName = `E2E Brand ${Date.now()}`;

async function signIn(page: Page): Promise<void> {
  await page.goto("/platform/login");
  await page.waitForLoadState("domcontentloaded");
  await page.locator("#platform-email").waitFor({ state: "visible", timeout: 20_000 });
  await page.fill("#platform-email", platformEmail);
  await page.fill("#platform-password", platformPassword);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/platform/dashboard", { timeout: 20_000 });
}

async function readCurrentProductName(page: Page): Promise<string> {
  const response = await page.request.get("/api/platform/branding");
  expect(response.ok()).toBe(true);
  const body = (await response.json()) as { branding: { productName: string } };
  return body.branding.productName;
}

async function saveProductName(page: Page, value: string): Promise<void> {
  await page.goto("/platform/settings?section=branding");
  await page.locator("#platform-product-name").waitFor({ state: "visible", timeout: 20_000 });
  await page.fill("#platform-product-name", value);
  const response = page.waitForResponse(
    (candidate) =>
      candidate.url().includes("/api/platform/branding") && candidate.request().method() === "PUT",
  );
  await page.getByRole("button", { name: "Save Institution" }).click();
  expect((await response).status()).toBe(200);
}

test.describe.serial("Platform settings white-label", { tag: "@local-only" }, () => {
  test.beforeAll(() => {
    ensureE2ePlatformAdmin(platformEmail, platformPassword);
  });

  test("renders all parity tabs and propagates branding to the apex login", async ({ page }) => {
    await signIn(page);
    const originalName = await readCurrentProductName(page);

    try {
      await page.goto("/platform/settings?section=global");
      for (const label of [
        "Global & TLS",
        "Branding",
        "Appearance & Theme",
        "Modules",
        "AI Assistant",
        "Backup & Restore",
      ]) {
        await expect(page.getByRole("button", { name: label })).toBeVisible();
      }

      await saveProductName(page, temporaryProductName);

      const publicResponse = await page.request.get("/api/public/platform-branding");
      expect(publicResponse.ok()).toBe(true);
      const publicBody = (await publicResponse.json()) as {
        branding: { productName: string };
      };
      expect(publicBody.branding.productName).toBe(temporaryProductName);

      // A clean context has no platform session, so the apex sign-in page renders.
      const browser = page.context().browser();
      expect(browser).not.toBeNull();
      const freshContext = await browser!.newContext();
      const freshPage = await freshContext.newPage();
      await freshPage.goto("/platform/login");
      await expect(freshPage).toHaveTitle(new RegExp(temporaryProductName), {
        timeout: 20_000,
      });
      await freshContext.close();
    } finally {
      await saveProductName(page, originalName);
    }
  });

  test("locks super-user-only tabs for a settings-grant admin", async ({ page }) => {
    await signIn(page);
    const notice = "Only the platform super-user can change this section.";

    await page.goto("/platform/settings?section=modules");
    await expect(page.getByText(notice)).toBeVisible();

    await page.goto("/platform/settings?section=llm");
    await expect(page.getByText(notice)).toBeVisible();

    await page.goto("/platform/settings?section=backup");
    await expect(page.getByText(notice)).toBeVisible();
  });
});
