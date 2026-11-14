import { test, expect, type Page } from "@playwright/test";
import { bootstrapAuthenticatedTenantViaApi } from "../../helpers/tenantApiBootstrap.js";
import type { TenantBootstrapCredentials } from "../../helpers/tenantBootstrap.js";
import { selectOptionByMatchingText } from "../../helpers/tenantOperations.js";

process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "e2e-test-jwt-secret-key-at-least-32-chars-long";

/**
 * Voucher write flow (Work → Journal → New Entry).
 *
 * The DB suites prove the ledger rules; this spec proves the browser cannot bypass
 * them: an unbalanced voucher is refused inside the modal, and the same voucher
 * posts once the credit matches — then the Trial Balance reflects it. Runs only
 * with the browser harness (`--with-e2e`), like the other accounting specs.
 */

const BLANK_DOCUMENT = "/site.webmanifest";

async function postJson(page: Page, origin: string, path: string, body: unknown): Promise<number> {
  if (!page.url().startsWith(origin)) await page.goto(`${origin}${BLANK_DOCUMENT}`);
  return page.evaluate(
    async ({ target, payload }) => {
      const csrf = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]*)/)?.[1];
      const res = await fetch(target, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(csrf ? { "X-CSRF-Token": decodeURIComponent(csrf) } : {}),
        },
        body: JSON.stringify(payload),
      });
      return res.status;
    },
    { target: path, payload: body },
  );
}

test.describe.serial("Accounting voucher write flow", { tag: "@local-only" }, () => {
  const subdomain = `acctvoucher${Date.now()}`;
  const tenantOrigin = `http://${subdomain}.localhost:5173`;
  const credentials: TenantBootstrapCredentials = {
    subdomain,
    tenantOrigin,
    adminEmail: `admin@${subdomain}.com`,
    adminPassword: "Madrasa@1234",
    changedAdminPassword: "Madrasa@5678",
    platformEmail: `platform-${subdomain}@test.com`,
    platformPassword: "Pa$$w0rd123",
  };

  test("blocks an unbalanced voucher, posts a balanced one and shows it in the trial balance", async ({
    page,
  }) => {
    test.setTimeout(240_000);
    await bootstrapAuthenticatedTenantViaApi(page, credentials);
    await expect(page.locator("h1")).toContainText("Assalamu Alaikum");

    // A fresh tenant has no chart; seed it through the same route the UI calls.
    expect(
      await postJson(page, tenantOrigin, "/api/accounting/accounts/seed-default", {}),
    ).toBeLessThan(300);

    await page.goto(`${tenantOrigin}/accounting`);
    await page.waitForLoadState("domcontentloaded");

    await page
      .getByRole("tab", { name: /Journal/i })
      .first()
      .click();
    await page
      .getByRole("button", { name: /New Entry/i })
      .first()
      .click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: /New Journal Entry/i })).toBeVisible({
      timeout: 15_000,
    });

    /** Pick a seeded account in a line row by typing its code. */
    const pickAccount = async (lineNumber: number, code: string) => {
      const select = dialog.getByLabel(new RegExp(`Account for line ${lineNumber}`, "i")).first();
      await selectOptionByMatchingText(select, code);
    };

    await pickAccount(1, "10100");
    await pickAccount(2, "41000");

    await dialog.locator("#journal-entry-description").fill("Test journal voucher");

    const mirrorCheckbox = dialog.getByRole("checkbox", { name: /Copy amount to the other line/i });
    if (await mirrorCheckbox.isChecked()) {
      await mirrorCheckbox.uncheck();
    }

    await dialog.getByLabel(/Debit amount for line 1/i).fill("100");
    await dialog.getByLabel(/Credit amount for line 2/i).fill("90");

    // Unbalanced posted voucher: the client rule refuses before any request.
    await expect(dialog.getByRole("button", { name: /Post Entry/i })).toBeDisabled();
    await expect(dialog.getByRole("status")).toContainText(/Out of balance/i);
    await expect(dialog).toBeVisible();

    // Balance it and post for real.
    await dialog.getByLabel(/Credit amount for line 2/i).fill("100");
    await expect(dialog.getByRole("button", { name: /Post Entry/i })).toBeEnabled();
    await dialog.getByRole("button", { name: /Post Entry/i }).click();
    await expect(dialog).toBeHidden({ timeout: 20_000 });

    // The posted voucher reaches the server-side trial balance, not just the list.
    await page
      .getByRole("tab", { name: /Trial Balance|Trial/i })
      .first()
      .click();
    await expect(page.getByText(/100\.00/).first()).toBeVisible({ timeout: 20_000 });
  });
});
