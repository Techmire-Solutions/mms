import { test, expect, type Page } from "@playwright/test";
import { bootstrapAuthenticatedTenantViaApi } from "../../helpers/tenantApiBootstrap.js";
import type { TenantBootstrapCredentials } from "../../helpers/tenantBootstrap.js";

process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "e2e-test-jwt-secret-key-at-least-32-chars-long";

/**
 * Browser smoke for the form-hardening closeout: RBAC custom roles and
 * messaging templates must create/edit/validate/reset through the real modal
 * path. Local-only because it mutates workspace settings.
 */
test.describe.serial("Form validation smoke", { tag: "@local-only" }, () => {
  let credentials: TenantBootstrapCredentials;
  let tierNav: ReturnType<Page["getByRole"]>;

  test.beforeEach(async ({ page }) => {
    const subdomain = `formsmoke${Date.now()}${Math.floor(Math.random() * 1000)}`;
    credentials = {
      subdomain,
      tenantOrigin: `http://${subdomain}.localhost:5173`,
      adminEmail: `admin@${subdomain}.com`,
      adminPassword: "Madrasa@1234",
      changedAdminPassword: "Madrasa@5678",
      platformEmail: `platform-${subdomain}@test.com`,
      platformPassword: "Pa$$w0rd123",
    };
    await bootstrapAuthenticatedTenantViaApi(page, credentials);
    await expect(page.locator("h1")).toContainText("Assalamu Alaikum");
    tierNav = page
      .getByRole("tablist", { name: "Section navigation" })
      .or(page.getByRole("navigation", { name: "Section navigation" }))
      .first();
  });

  test("creates, edits, validates and resets a custom role", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(`${credentials.tenantOrigin}/users`);
    await page.waitForLoadState("domcontentloaded");

    await expect(tierNav).toBeVisible({ timeout: 15_000 });
    await tierNav.getByRole("tab", { name: /Setup/i }).first().click();
    await page
      .getByRole("tab", { name: /Permissions/i })
      .first()
      .click();
    await expect(page.getByText("Roles", { exact: true }).first()).toBeVisible();

    const roleName = `E2E Role ${Date.now()}`;
    await page.getByRole("button", { name: "Role", exact: true }).first().click();
    let dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Create Custom Role" })).toBeVisible();
    await dialog.locator("#role-name").fill(roleName);
    await dialog.locator("#role-desc").fill("Smoke role");
    await dialog.getByRole("button", { name: "Save Role" }).click();
    await expect(dialog).toBeHidden({ timeout: 15_000 });
    await expect(page.getByText(roleName).first()).toBeVisible({ timeout: 15_000 });

    await page
      .getByRole("button", {
        name: `Edit role details for ${roleName}`,
        exact: true,
      })
      .click();
    dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: new RegExp(`Edit role: ${roleName}`) }),
    ).toBeVisible();
    const editedName = `${roleName} Edited`;
    await dialog.locator("#role-name").fill(editedName);
    await dialog.getByRole("button", { name: "Save Role" }).click();
    await expect(dialog).toBeHidden({ timeout: 15_000 });
    await expect(page.getByText(editedName).first()).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "Role", exact: true }).first().click();
    dialog = page.getByRole("dialog");
    await dialog.locator("#role-name").fill(editedName);
    await dialog.getByRole("button", { name: "Save Role" }).click();
    await expect(dialog.getByText("A custom role with this name already exists.")).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await page.getByRole("button", { name: "Yes" }).click();
    await expect(dialog).toBeHidden({ timeout: 15_000 });

    await page
      .getByRole("button", {
        name: `Edit role details for ${editedName}`,
        exact: true,
      })
      .click();
    dialog = page.getByRole("dialog");
    await dialog.locator("#role-name").fill(`${editedName} Discard`);
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByText(/unsaved role changes/i)).toBeVisible();
    await page.getByRole("button", { name: "Yes" }).click();
    await expect(dialog).toBeHidden({ timeout: 15_000 });
  });

  test("validates, creates, edits and resets a messaging template", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(`${credentials.tenantOrigin}/messaging`);
    await page.waitForLoadState("domcontentloaded");

    await expect(tierNav).toBeVisible({ timeout: 15_000 });
    await tierNav.getByRole("tab", { name: /Setup/i }).first().click();
    await page.getByRole("button", { name: "Create Preset Template" }).first().click();

    let dialog = page.getByRole("dialog");
    await expect(dialog.locator("#tplLabel")).toBeVisible();
    const label = `E2E Template ${Date.now()}`;
    await dialog.locator("#tplLabel").fill(label);
    await dialog.locator("#tplBody").fill("Hello {not_a_real_token}");
    const save = dialog.getByRole("button", { name: "Save New Template" });
    await expect(save).toBeDisabled();

    await dialog.locator("#tplBody").fill("Hello {name}, welcome.");
    const create = page.waitForResponse(
      (response) =>
        response.url().includes("/api/messaging/templates") &&
        response.request().method() === "POST",
    );
    await expect(save).toBeEnabled();
    await save.click();
    await expect(dialog).toBeHidden({ timeout: 20_000 });
    const templateResponse = await create;
    expect(templateResponse.ok()).toBe(true);
    await expect(page.getByText(label).first()).toBeVisible({ timeout: 15_000 });

    const row = page.getByRole("row", { name: new RegExp(label) }).first();
    await row.getByRole("button", { name: "Edit" }).click();
    dialog = page.getByRole("dialog");
    await expect(dialog.locator("#tplLabel")).toHaveValue(label);
    await dialog.locator("#tplBody").fill("Hello {name}, updated.");
    await dialog.getByRole("button", { name: "Update Template" }).click();
    await expect(dialog).toBeHidden({ timeout: 20_000 });

    await row.getByRole("button", { name: "Edit" }).click();
    dialog = page.getByRole("dialog");
    await dialog.locator("#tplBody").fill("Discard me");
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByText(/discard unsaved template/i)).toBeVisible();
    await page.getByRole("button", { name: "Yes" }).click();
    await expect(dialog).toBeHidden({ timeout: 15_000 });
  });
});
