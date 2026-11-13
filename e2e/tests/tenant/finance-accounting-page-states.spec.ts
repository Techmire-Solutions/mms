import { test, expect } from "@playwright/test";
import { bootstrapAuthenticatedTenantViaApi } from "../../helpers/tenantApiBootstrap.js";
import type { TenantBootstrapCredentials } from "../../helpers/tenantBootstrap.js";

process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "e2e-test-jwt-secret-key-at-least-32-chars-long";

/**
 * Finance/Accounting page-state smoke (Work / Reports / Setup, ledger, report charts).
 *
 * The heavy data lifecycle (invoice → payment → ledger) is covered by the DB
 * integration suites and the inject route tests; this spec proves the pages and
 * their loading/empty states render for a freshly provisioned tenant, including
 * the reports chrome and the ledger explorer.
 */
test.describe.serial("Finance & Accounting page states", { tag: "@local-only" }, () => {
  const subdomain = `finpage${Date.now()}`;
  const tenantOrigin = `http://${subdomain}.localhost:5173`;
  const adminEmail = `admin@${subdomain}.com`;
  const adminPassword = "Madrasa@1234";
  const changedAdminPassword = "Madrasa@5678";

  const credentials: TenantBootstrapCredentials = {
    subdomain,
    tenantOrigin,
    adminEmail,
    adminPassword,
    changedAdminPassword,
    platformEmail: `platform-${subdomain}@test.com`,
    platformPassword: "Pa$$w0rd123",
  };

  test("renders Finance Work, Reports and Setup tiers without crashing", async ({ page }) => {
    test.setTimeout(180_000);
    await bootstrapAuthenticatedTenantViaApi(page, credentials);
    await expect(page.locator("h1")).toContainText("Assalamu Alaikum");

    await page.goto(`${tenantOrigin}/finance`);
    await page.waitForLoadState("domcontentloaded");

    const tierNav = page
      .getByRole("tablist", { name: "Section navigation" })
      .or(page.getByRole("navigation", { name: "Section navigation" }))
      .first();
    await expect(tierNav).toBeVisible({ timeout: 15_000 });
    await expect(tierNav.getByRole("tab", { name: /Work/i }).first()).toBeVisible();
    await expect(tierNav.getByRole("tab", { name: /Reports/i }).first()).toBeVisible();
    await expect(tierNav.getByRole("tab", { name: /Setup/i }).first()).toBeVisible();

    // Work tier: invoices/payments sub-tabs are present (empty tenant shows the empty state).
    await expect(page.getByRole("tab", { name: /Invoices/i }).first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByRole("tab", { name: /Payments/i }).first()).toBeVisible();

    // Reports tier renders the tools shell for a tenant with no financial data.
    await tierNav
      .getByRole("tab", { name: /Reports/i })
      .first()
      .click();
    await expect(page.getByText(/Report/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test("renders the Accounting ledger and reports surfaces for an empty workspace", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await bootstrapAuthenticatedTenantViaApi(page, credentials);
    await page.goto(`${tenantOrigin}/accounting`);
    await page.waitForLoadState("domcontentloaded");

    const tierNav = page
      .getByRole("tablist", { name: "Section navigation" })
      .or(page.getByRole("navigation", { name: "Section navigation" }))
      .first();
    await expect(tierNav).toBeVisible({ timeout: 15_000 });

    // Work → Ledger: the explorer asks for an account instead of rendering a broken table.
    await page
      .getByRole("tab", { name: /Ledger/i })
      .first()
      .click();
    await expect(page.getByText(/select an account/i).first()).toBeVisible({ timeout: 15_000 });

    // Reports tier: the statement view tabs render with the empty-state panels.
    await tierNav
      .getByRole("tab", { name: /Reports/i })
      .first()
      .click();
    await expect(page.getByRole("tab", { name: /Income|Balance|Cash/i }).first()).toBeVisible({
      timeout: 15_000,
    });
  });
});
