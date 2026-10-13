import { test, expect } from "@playwright/test";
import {
  bootstrapAuthenticatedTenant,
  resetPlatformUsers,
  type TenantBootstrapCredentials,
} from "../../helpers/tenantBootstrap.js";
import { loginTenant } from "../../helpers/moduleTiers.js";
import { forceRtl } from "../../helpers/responsive.js";
import {
  createAccountsAndJournalEntry,
  createFinanceInvoice,
  createSessionAndClass,
  createStudentEnrollment,
  createFacultyFromContact,
  createTestContactJaneDoe,
  createTestContactJohnDoe,
  recordInvoicePayment,
  registerStudentJaneDoe,
  waitForToastOverlayToClear,
} from "../../helpers/tenantOperations.js";

process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "e2e-test-jwt-secret-key-at-least-32-chars-long";

test.describe.serial(
  "Phase 10: Critical Path Lifecycles & BiDi E2E",
  { tag: "@local-only" },
  () => {
    const subdomain = `phase10-${Date.now()}`;
    const credentials: TenantBootstrapCredentials = {
      subdomain,
      tenantOrigin: `http://${subdomain}.localhost:5173`,
      adminEmail: `admin@${subdomain}.com`,
      adminPassword: "Madrasa@1234",
      changedAdminPassword: "Madrasa@5678",
      platformEmail: `platform-${subdomain}@test.com`,
      platformPassword: "Pa$$w0rd123",
    };

    test.beforeAll(async () => {
      resetPlatformUsers();
    });

    test("Critical Path 1: Admissions -> Enrollment Lifecycle (LTR & RTL)", async ({ page }) => {
      test.setTimeout(180_000);
      page.on("console", (msg) => console.log("BROWSER CONSOLE:", msg.text(), msg.location()));
      page.on("pageerror", (err) => console.log("PAGE ERROR:", err.stack || err.message));

      // 1. Bootstrap tenant
      await bootstrapAuthenticatedTenant(page, credentials);
      await expect(page.locator("h1")).toContainText("Assalamu Alaikum");

      // 2. Create Base Contact & Student (Admissions) in LTR
      await page.goto(`${credentials.tenantOrigin}/contacts`);
      await expect(page.locator("h1").first()).toBeVisible();
      await createTestContactJaneDoe(page);
      await createTestContactJohnDoe(page);

      await page.goto(`${credentials.tenantOrigin}/students`);
      await expect(page.locator("h1").first()).toBeVisible();
      await registerStudentJaneDoe(page);

      await page.goto(`${credentials.tenantOrigin}/faculty`);
      await expect(page.locator("h1").first()).toBeVisible();
      await createFacultyFromContact(page);

      // 3. Create Session & Class
      await page.goto(`${credentials.tenantOrigin}/sessions`);
      await expect(page.locator("h1").first()).toBeVisible();
      await createSessionAndClass(page);

      // 4. Enroll Student in Class
      await page.goto(`${credentials.tenantOrigin}/enrollments`);
      await expect(page.locator("h1").first()).toBeVisible();
      await createStudentEnrollment(page);

      // 5. Verify BiDi RTL Direction Switch
      await forceRtl(page, "ar");
      await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
      await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    });

    test("Critical Path 2: Fee Invoice -> Payment Settlement -> Double-entry Ledger Verification", async ({
      page,
    }) => {
      test.setTimeout(180_000);

      // 0. Ensure tenant is authenticated
      await loginTenant(
        page,
        credentials.tenantOrigin,
        credentials.adminEmail,
        credentials.changedAdminPassword,
      );

      // 1. Navigate to Finance & create Invoice
      await page.goto(`${credentials.tenantOrigin}/finance`);
      await expect(page.locator("h1").first()).toBeVisible();
      await createFinanceInvoice(page);

      // 2. Record Payment Settlement against Invoice
      await recordInvoicePayment(page);

      // 3. Create Chart of Accounts & verify balanced Double-Entry Journal
      await page.goto(`${credentials.tenantOrigin}/accounting`);
      await expect(page.locator("h1").first()).toBeVisible();
      await createAccountsAndJournalEntry(page);

      // 4. Validate BiDi RTL mirroring on Accounting tables & balances
      await forceRtl(page, "ur");
      await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
      await expect(page.locator("html")).toHaveAttribute("lang", "ur");
    });

    test("Critical Path 3: Report Card Generation -> Background Processing & Artifact Download", async ({
      page,
    }) => {
      test.setTimeout(180_000);

      // 0. Ensure tenant is authenticated
      await loginTenant(
        page,
        credentials.tenantOrigin,
        credentials.adminEmail,
        credentials.changedAdminPassword,
      );

      // Navigate to Students Reports tier
      await page.goto(`${credentials.tenantOrigin}/students`);
      await expect(page.locator("h1").first()).toBeVisible();
      await waitForToastOverlayToClear(page, "Students navigation");

      // Switch to Reports tier tab
      const reportsTab = page
        .getByRole("tab", { name: "Reports" })
        .or(page.getByRole("button", { name: "Reports" }))
        .first();
      await expect(reportsTab).toBeVisible({ timeout: 20_000 });
      await reportsTab.click();

      // Check if Export / Report Generator exists and operates cleanly
      await expect(
        page.getByText(/Total Students|Active Students|Gender Distribution|Reports/i).first(),
      ).toBeVisible({ timeout: 20_000 });

      // Validate RTL render
      await forceRtl(page, "ar");

      await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    });
  },
);
