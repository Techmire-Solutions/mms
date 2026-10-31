import { test, expect, type Page } from "@playwright/test";
import { bootstrapAuthenticatedTenantViaApi } from "../../helpers/tenantApiBootstrap.js";
import { loginTenant } from "../../helpers/moduleTiers.js";
import type { TenantBootstrapCredentials } from "../../helpers/tenantBootstrap.js";

process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "e2e-test-jwt-secret-key-at-least-32-chars-long";

/**
 * Static JSON from the frontend: puts the page on origin without booting the SPA.
 */
const BLANK_DOCUMENT = "/site.webmanifest";

async function sendJson(
  page: Page,
  origin: string,
  method: "POST" | "PUT",
  path: string,
  body: unknown,
): Promise<{ status: number; text: string }> {
  if (!page.url().startsWith(origin)) await page.goto(`${origin}${BLANK_DOCUMENT}`);
  const result = await page.evaluate(
    async ({ httpMethod, target, payload }) => {
      const csrf = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]*)/)?.[1];
      const res = await fetch(target, {
        method: httpMethod,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(csrf ? { "X-CSRF-Token": decodeURIComponent(csrf) } : {}),
        },
        body: JSON.stringify(payload),
      });
      return { status: res.status, text: await res.text() };
    },
    { httpMethod: method, target: path, payload: body },
  );
  return result;
}

test.describe.serial("Accounting Roles and Sub-Tabs E2E Flow", { tag: "@local-only" }, () => {
  const subdomain = `acct${Date.now()}`;
  const tenantOrigin = `http://${subdomain}.localhost:5173`;
  const adminEmail = `admin@${subdomain}.com`;
  const adminPassword = "Madrasa@1234";
  const changedAdminPassword = "Madrasa@5678";
  const accountantEmail = `accountant@${subdomain}.com`;
  const accountantPassword = "Accountant@1234";

  const credentials: TenantBootstrapCredentials = {
    subdomain,
    tenantOrigin,
    adminEmail,
    adminPassword,
    changedAdminPassword,
    platformEmail: `platform-${subdomain}@test.com`,
    platformPassword: "Pa$$w0rd123",
  };

  test("should verify Accounting Setup vs Work tabs for Admin and Accountant roles", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    // 1. Bootstrap tenant and login as Admin
    await bootstrapAuthenticatedTenantViaApi(page, credentials);
    await expect(page.locator("h1")).toContainText("Assalamu Alaikum");

    // 2. Admin navigates to /accounting
    await page.goto(`${tenantOrigin}/accounting`);
    await page.waitForLoadState("domcontentloaded");

    // Confirm tier tabs for Admin: Work, Reports, Setup are all present
    const tierNav = page
      .getByRole("tablist", { name: "Section navigation" })
      .or(page.getByRole("navigation", { name: "Section navigation" }))
      .first();
    await expect(tierNav).toBeVisible({ timeout: 15_000 });

    const setupTab = tierNav.getByRole("tab", { name: /Setup/i }).first();
    const workTab = tierNav.getByRole("tab", { name: /Accounting|Work/i }).first();
    await expect(setupTab).toBeVisible();
    await expect(workTab).toBeVisible();

    // In Work tier, confirm Banking and Period-end sub-tabs are visible
    const bankingSubTab = page.getByRole("tab", { name: /Banking/i }).first();
    const periodEndSubTab = page.getByRole("tab", { name: /Period-end/i }).first();
    await expect(bankingSubTab).toBeVisible({ timeout: 10_000 });
    await expect(periodEndSubTab).toBeVisible({ timeout: 10_000 });

    // Click Setup tab: verify Preferences no longer renders moved operational sections
    await setupTab.click();
    await page.waitForLoadState("domcontentloaded");
    await expect(page.getByText(/Fiscal Years/i).first()).toBeVisible({ timeout: 10_000 });

    // Assert that Bank Reconciliation and FX Revaluation sections do NOT exist in Setup
    await expect(page.getByText(/Bank reconciliation/i)).toHaveCount(0);
    await expect(page.getByText(/Period-end FX revaluation/i)).toHaveCount(0);
    await expect(page.getByText(/Hedge accounting/i)).toHaveCount(0);

    // 3. Configure users settings to disable requireEmailVerification for test
    const prefResult = await sendJson(page, tenantOrigin, "PUT", "/api/users/preferences", {
      requireEmailVerification: false,
    });
    expect(prefResult.status).toBeLessThan(300);

    // Create a Contact and Accountant user via API while authenticated as Admin
    const contactResult = await sendJson(page, tenantOrigin, "POST", "/api/contacts", {
      firstName: "E2E",
      lastName: "Accountant",
      gender: "Male",
      emails: [{ address: accountantEmail, isPrimary: true }],
      phones: [{ number: "03001234567", isPrimary: true }],
    });
    expect(contactResult.status).toBeLessThan(300);
    const contactData = JSON.parse(contactResult.text) as { contact: { id: string } };

    const createResult = await sendJson(page, tenantOrigin, "POST", "/api/users", {
      contactId: contactData.contact.id,
      role: "accountant",
      status: "active",
      setupMethod: "password",
      password: accountantPassword,
      forceReset: false,
      twoFactorEnabled: false,
    });
    expect(createResult.status).toBe(200);

    // 4. Log out Admin by clearing cookies and logging in as Accountant
    await page.context().clearCookies();
    await loginTenant(page, tenantOrigin, accountantEmail, accountantPassword);
    await expect(page.locator("h1")).toContainText("Assalamu Alaikum");

    // 5. Accountant navigates to /accounting
    await page.goto(`${tenantOrigin}/accounting`);
    await page.waitForLoadState("domcontentloaded");

    const acctTierNav = page
      .getByRole("tablist", { name: "Section navigation" })
      .or(page.getByRole("navigation", { name: "Section navigation" }))
      .first();
    await expect(acctTierNav).toBeVisible({ timeout: 15_000 });

    // Setup tab MUST NOT be present for Accountant
    await expect(acctTierNav.getByRole("tab", { name: /Setup/i })).toHaveCount(0);

    // Work tier sub-tabs MUST include Banking and Period-end
    const acctBankingTab = page.getByRole("tab", { name: /Banking/i }).first();
    const acctPeriodEndTab = page.getByRole("tab", { name: /Period-end/i }).first();
    await expect(acctBankingTab).toBeVisible({ timeout: 10_000 });
    await expect(acctPeriodEndTab).toBeVisible({ timeout: 10_000 });

    // 6. Test Banking sub-tab as Accountant
    await acctBankingTab.click();
    await expect(page.getByText(/Bank reconciliation/i).first()).toBeVisible({ timeout: 10_000 });
    // Action buttons must be rendered for accountant
    const saveStatementBtn = page.getByRole("button", { name: /Save statement/i }).first();
    await expect(saveStatementBtn).toBeVisible();
    const matchLineBtn = page.getByRole("button", { name: /Match line/i }).first();
    await expect(matchLineBtn).toBeVisible();

    // 7. Test Period-end sub-tab as Accountant
    await acctPeriodEndTab.click();
    await expect(page.getByText(/Period-end FX revaluation/i).first()).toBeVisible({
      timeout: 10_000,
    });

    // Verify FX Revaluation preview button is active
    const previewFxBtn = page.getByRole("button", { name: /^Preview$/i }).first();
    await expect(previewFxBtn).toBeVisible();
    await expect(previewFxBtn).toBeEnabled();

    // Verify Hedges and Opening Balances sections are visible
    await expect(page.getByText(/Hedge accounting/i).first()).toBeVisible();
    await expect(page.getByText(/Opening balances/i).first()).toBeVisible();

    // Confirm Fiscal-Year Close is NOT offered to Accountant
    await expect(page.getByRole("button", { name: /Close fiscal year/i })).toHaveCount(0);
  });
});
