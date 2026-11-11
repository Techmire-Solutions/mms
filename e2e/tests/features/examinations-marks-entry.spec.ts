import { expect, test } from "@playwright/test";
import { bootstrapAuthenticatedTenantViaApi } from "../../helpers/tenantApiBootstrap.js";
import { ensureWorkTierActive, seedExamForE2e } from "../../helpers/tenantOperations.js";
import type { TenantBootstrapCredentials } from "../../helpers/tenantBootstrap.js";

process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "e2e-test-jwt-secret-key-at-least-32-chars-long";

/**
 * Marks-entry flow: keyboard entry, immediate out-of-range validation, dirty/discard, and the
 * published-results lock. Uses an isolated API-bootstrapped tenant and a seeded class/exam so it
 * can run beside other specs in CI (no `resetPlatformUsers`).
 */
test.describe.serial("Examinations marks entry", () => {
  let credentials: TenantBootstrapCredentials;

  test.beforeAll(async () => {
    const subdomain = `exame2e${Date.now()}`;
    credentials = {
      subdomain,
      tenantOrigin: `http://${subdomain}.localhost:5173`,
      adminEmail: `admin@${subdomain}.com`,
      adminPassword: "Madrasa@1234",
      changedAdminPassword: "Madrasa@5678",
      platformEmail: `platform-${subdomain}@test.com`,
      platformPassword: "Pa$$w0rd123",
    };
  });

  test("enters, validates and saves marks, then locks published results", async ({ page }) => {
    test.setTimeout(180_000);
    await bootstrapAuthenticatedTenantViaApi(page, credentials);
    await page.goto(`${credentials.tenantOrigin}/examinations`);
    await page.waitForLoadState("domcontentloaded");
    await ensureWorkTierActive(page);
    seedExamForE2e(credentials.subdomain);
    await page.reload();
    await page.waitForLoadState("domcontentloaded");

    await page
      .getByRole("button", { name: /enter marks|marks/i })
      .first()
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 20_000 });
    await dialog.getByRole("radio", { name: "E2E Midterm" }).click();

    const input = dialog.locator("[data-marks-input]").first();
    await expect(input).toBeVisible({ timeout: 20_000 });
    await input.fill("150");
    await expect(
      dialog.getByText(/enter 0[–-]100|out of range|between 0 and|invalid/i).first(),
    ).toBeVisible();
    await expect(dialog.getByRole("button", { name: /save marks/i })).toBeDisabled();

    await input.fill("88");
    await expect(dialog.getByRole("button", { name: /save marks/i })).toBeEnabled();

    // Keyboard navigation reaches the next row (or stays on the last row for a one-student roster).
    await input.press("ArrowDown");

    const saved = page.waitForResponse(
      (response) =>
        response.url().includes("/api/examinations/results/bulk") &&
        response.request().method() === "PUT",
      { timeout: 30_000 },
    );
    await dialog.getByRole("button", { name: /save marks/i }).click();
    const response = await saved;
    expect(response.ok()).toBe(true);

    // Dirty-close guard: after another edit, closing the modal asks before discarding.
    await input.fill("91");
    await dialog.getByRole("button", { name: "Close" }).click();
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await page.getByRole("button", { name: /cancel/i }).click();

    // Publish through the API, then reopening the grid must show the read-only lock.
    await page.evaluate(async () => {
      const csrf = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]*)/)?.[1];
      await fetch("/api/examinations/exams/e2e-midterm/results-finalization", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(csrf ? { "X-CSRF-Token": decodeURIComponent(csrf) } : {}),
        },
        body: JSON.stringify({ finalized: true }),
      });
    });
    await page.reload();
    await page.waitForLoadState("domcontentloaded");
    await ensureWorkTierActive(page);
    await page
      .getByRole("button", { name: /enter marks|marks/i })
      .first()
      .click();
    const lockedDialog = page.getByRole("dialog");
    await lockedDialog.getByRole("radio", { name: "E2E Midterm" }).click();
    await expect(lockedDialog.getByText(/results are published/i)).toBeVisible({ timeout: 20_000 });
    await expect(lockedDialog.locator("[data-marks-input]").first()).toBeDisabled();
  });
});
