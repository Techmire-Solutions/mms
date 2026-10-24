import { test, expect } from "@playwright/test";
import { assertModuleTierSmoke } from "../../helpers/moduleTiers.js";
import {
  bootstrapAuthenticatedTenant,
  resetPlatformUsers,
  type TenantBootstrapCredentials,
} from "../../helpers/tenantBootstrap.js";
import {
  createAccountsAndJournalEntry,
  createFinanceInvoice,
  createMessagingTemplateAndCampaign,
  createSessionAndClass,
  createStudentEnrollment,
  createFacultyFromContact,
  createTestContactJaneDoe,
  createTestContactJohnDoe,
  createUserFromContact,
  recordInvoicePayment,
  registerStudentJaneDoe,
} from "../../helpers/tenantOperations.js";

process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "e2e-test-jwt-secret-key-at-least-32-chars-long";

test.describe.serial("Tenant Operations & Module Flows E2E", { tag: "@local-only" }, () => {
  const subdomain = `ops${Date.now()}`;
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

  test("should execute full operational module flows: faculty, finance, sessions, enrollments, messaging, accounting, and users", async ({
    page,
  }) => {
    test.setTimeout(270_000);

    // Bootstrap tenant workspace and login
    await bootstrapAuthenticatedTenant(page, credentials);
    await expect(page.locator("h1")).toContainText("Assalamu Alaikum");

    // 1. Verify module shells accessibility
    for (const modulePath of [
      "/faculty",
      "/finance",
      "/sessions",
      "/messaging",
      "/users",
      "/accounting",
    ] as const) {
      await assertModuleTierSmoke(page, modulePath, credentials.tenantOrigin);
    }

    // 2. Soft-delete trash toggle check on Students
    await page.goto(`${credentials.tenantOrigin}/students`);
    await page.waitForLoadState("domcontentloaded");
    const trashToggle = page.getByRole("button", { name: /Show deleted|Show active/i }).first();
    await expect(trashToggle).toBeVisible({ timeout: 20_000 });
    await trashToggle.click();
    const showActiveBtn = page.getByRole("button", { name: /Show active/i }).first();
    await expect(showActiveBtn).toBeVisible();
    await showActiveBtn.click();

    // 3. Settings shell check
    await page.goto(`${credentials.tenantOrigin}/settings`);
    await page.waitForLoadState("domcontentloaded");
    await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible({
      timeout: 20_000,
    });

    // 4. Create base contacts (Jane Doe & John Doe) and Student
    await page.goto(`${credentials.tenantOrigin}/contacts`);
    await page.waitForLoadState("domcontentloaded");
    await createTestContactJaneDoe(page);
    await createTestContactJohnDoe(page);

    await page.goto(`${credentials.tenantOrigin}/students`);
    await page.waitForLoadState("domcontentloaded");
    await registerStudentJaneDoe(page);

    // 5. Create Faculty from John Doe contact
    await page.goto(`${credentials.tenantOrigin}/faculty`);
    await page.waitForLoadState("domcontentloaded");
    await createFacultyFromContact(page);

    // 6. Create Finance Invoice for Jane Doe
    await page.goto(`${credentials.tenantOrigin}/finance`);
    await page.waitForLoadState("domcontentloaded");
    await createFinanceInvoice(page);

    // 7. Create Session & Class
    await page.goto(`${credentials.tenantOrigin}/sessions`);
    await page.waitForLoadState("domcontentloaded");
    await createSessionAndClass(page);

    // 8. Enroll Jane Doe in Afternoon Tajweed 2026
    await page.goto(`${credentials.tenantOrigin}/enrollments`);
    await page.waitForLoadState("domcontentloaded");
    await createStudentEnrollment(page);

    // 9. Record Invoice Payment
    await page.goto(`${credentials.tenantOrigin}/finance`);
    await page.waitForLoadState("domcontentloaded");
    await recordInvoicePayment(page);

    // 10. Create Messaging Template & dispatch SMS campaign
    await page.goto(`${credentials.tenantOrigin}/messaging`);
    await page.waitForLoadState("domcontentloaded");
    await createMessagingTemplateAndCampaign(page);

    // 11. Create Chart of Accounts & balanced Journal Entry
    await page.goto(`${credentials.tenantOrigin}/accounting`);
    await page.waitForLoadState("domcontentloaded");
    await createAccountsAndJournalEntry(page);

    // 12. Create User account for John Doe
    await page.goto(`${credentials.tenantOrigin}/users`);
    await page.waitForLoadState("domcontentloaded");
    await createUserFromContact(page);
  });
});
