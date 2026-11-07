import { test, expect } from "@playwright/test";
import {
  bootstrapAuthenticatedTenant,
  resetPlatformUsers,
  type TenantBootstrapCredentials,
} from "../../helpers/tenantBootstrap.js";
import {
  createFacultyFromContact,
  createSessionAndClass,
  createTestContactJaneDoe,
  createTestContactJohnDoe,
  registerStudentJaneDoe,
  waitForToastOverlayToClear,
} from "../../helpers/tenantOperations.js";

process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "e2e-test-jwt-secret-key-at-least-32-chars-long";

test.describe.serial("Sessions lifecycle E2E", { tag: "@local-only" }, () => {
  const subdomain = `sessions-lifecycle-${Date.now()}`;
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

  test("creates, edits, and re-opens a session without stale detail data", async ({ page }) => {
    test.setTimeout(180_000);
    await bootstrapAuthenticatedTenant(page, credentials);

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

    await page.goto(`${credentials.tenantOrigin}/sessions`);
    await expect(page.locator("h1").first()).toBeVisible();
    await createSessionAndClass(page);
    await waitForToastOverlayToClear(page, "before session edit");

    const row = page.getByRole("button", { name: /Afternoon Tajweed 2026/i }).first();
    if (await row.isVisible().catch(() => false)) await row.click();
    const edit = page.getByRole("button", { name: "Edit Session" }).first();
    await expect(edit).toBeVisible({ timeout: 20_000 });
    await edit.click();

    const dialog = page.getByRole("dialog", { name: "Edit Session" });
    await expect(dialog).toBeVisible({ timeout: 20_000 });
    const name = dialog.getByLabel("Session name");
    await name.fill("Afternoon Tajweed 2026 Edited");
    const save = dialog.getByRole("button", { name: "Update" }).first();
    const update = page.waitForResponse(
      (response) =>
        response.url().includes("/api/sessions/") && response.request().method() === "PUT",
      { timeout: 30_000 },
    );
    await save.click();
    const response = await update;
    expect(response.ok()).toBe(true);
    await expect(dialog).toBeHidden({ timeout: 20_000 });
    await expect(page.getByText("Session updated").first()).toBeVisible({ timeout: 20_000 });

    // Re-open the row and verify the detail/edit surface reflects the committed edit.
    const updatedRow = page.getByRole("button", { name: /Afternoon Tajweed 2026 Edited/i }).first();
    await expect(updatedRow).toBeVisible({ timeout: 20_000 });
    await updatedRow.click();
    await expect(
      page.getByRole("heading", { name: /Afternoon Tajweed 2026 Edited/i }).first(),
    ).toBeVisible({ timeout: 20_000 });
  });
});
