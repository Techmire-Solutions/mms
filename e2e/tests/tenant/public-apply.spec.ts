import { expect, test } from "@playwright/test";
import {
  bootstrapAuthenticatedTenant,
  ensureE2ePlatformAdmin,
} from "../../helpers/tenantBootstrap.js";

process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "e2e-test-jwt-secret-key-at-least-32-chars-long";

const subdomain = `publicapply${Date.now()}`;
const tenantOrigin = `http://${subdomain}.localhost:5173`;
const adminEmail = `admin@${subdomain}.com`;
const temporaryPassword = "Madrasa@1234";
const permanentPassword = "Madrasa@5678";
const platformEmail = `platform-publicapply-${Date.now()}@test.com`;
const platformPassword = "Pa$$w0rd123";

test.describe("Public admissions page", { tag: "@local-only" }, () => {
  test("anonymous /apply stays public and explains the empty state", async ({ page, browser }) => {
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

    const anonymousContext = await browser.newContext({ baseURL: tenantOrigin });
    const anonymousPage = await anonymousContext.newPage();
    try {
      await anonymousPage.goto("/apply");
      await anonymousPage.waitForLoadState("domcontentloaded");
      await expect(anonymousPage).toHaveURL(/\/apply$/);
      await expect(anonymousPage).toHaveTitle(/Open admissions/i);
      await expect(anonymousPage.getByText(/No admissions are open/i).first()).toBeVisible();
      await expect(
        anonymousPage.getByRole("link", { name: /Sign in to your account/i }),
      ).toBeVisible();
    } finally {
      await anonymousContext.close();
    }
  });
});
