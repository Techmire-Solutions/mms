import { test, expect } from "@playwright/test";
import {
  bootstrapAuthenticatedTenant,
  resetPlatformUsers,
  type TenantBootstrapCredentials,
} from "../helpers/tenantBootstrap.js";
import {
  createTestContactJaneDoe,
  createTestContactJohnDoe,
  registerStudentJaneDoe,
  seedTestClassAndEnrollment,
} from "../helpers/tenantOperations.js";

process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "e2e-test-jwt-secret-key-at-least-32-chars-long";

test.describe.serial("Tenant Academic Flow E2E", { tag: "@local-only" }, () => {
  const subdomain = `acad${Date.now()}`;
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

  test("should create contacts, register student with guardian relationship, and submit class attendance", async ({
    page,
  }) => {
    test.setTimeout(120_000);

    // Bootstrap tenant workspace and login
    await bootstrapAuthenticatedTenant(page, credentials);
    await expect(page.locator("h1")).toContainText("Assalamu Alaikum");

    // 1. Contacts creation (Jane Doe & John Doe)
    await page.goto(`${credentials.tenantOrigin}/contacts`);
    await page.waitForLoadState("domcontentloaded");
    await createTestContactJaneDoe(page);
    await createTestContactJohnDoe(page);

    // 2. Student registration with guardian relationship link
    await page.goto(`${credentials.tenantOrigin}/students`);
    await page.waitForLoadState("domcontentloaded");
    await registerStudentJaneDoe(page);

    // 3. Seed class & enrollment via backend script
    seedTestClassAndEnrollment(subdomain);

    // 4. Attendance marking & submission
    await page.goto(`${credentials.tenantOrigin}/attendance`);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForSelector("#filter-class >> visible=true");
    await page.selectOption("#filter-class >> visible=true", { label: "Morning Quran Class" });
    await page.waitForLoadState("domcontentloaded");

    await page.waitForSelector("text=Jane Doe >> visible=true");

    const bulkSave = page.waitForResponse(
      (response) =>
        response.url().includes("/api/attendance/bulk") && response.request().method() === "PUT",
      { timeout: 30_000 },
    );
    await page.click('button:has-text("Submit Attendance") >> visible=true');
    const bulkResponse = await bulkSave;
    if (!bulkResponse.ok()) {
      throw new Error(
        `Attendance bulk save failed: HTTP ${bulkResponse.status()} ${await bulkResponse.text()}`,
      );
    }

    await page.waitForSelector("text=Submitted >> visible=true");
  });
});
