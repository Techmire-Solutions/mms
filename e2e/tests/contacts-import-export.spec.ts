import { test, expect } from "@playwright/test";
import {
  bootstrapAuthenticatedTenant,
  type TenantBootstrapCredentials,
} from "../helpers/tenantBootstrap.js";

process.env.NODE_ENV = process.env.NODE_ENV || "test";

/**
 * Contacts Work header CTAs: queued CSV export and the vCard import dialog.
 *
 * Bootstraps its own tenant (unique subdomain) so it never touches existing data. It
 * deliberately does **not** call `resetPlatformUsers()`, so it needs either an unclaimed
 * platform console or `E2E_PLATFORM_EMAIL` / `E2E_PLATFORM_PASSWORD` for an existing one —
 * otherwise it skips with an explicit reason instead of failing on a login selector.
 */
const subdomain = `ctc${Date.now()}`;
const credentials: TenantBootstrapCredentials = {
  subdomain,
  tenantOrigin: `http://${subdomain}.localhost:5173`,
  adminEmail: `admin@${subdomain}.com`,
  adminPassword: "Madrasa@1234",
  changedAdminPassword: "Madrasa@5678",
  platformEmail: process.env.E2E_PLATFORM_EMAIL || `platform-${subdomain}@test.com`,
  platformPassword: process.env.E2E_PLATFORM_PASSWORD || "Pa$$w0rd123",
};

const VCARD = [
  "BEGIN:VCARD",
  "VERSION:3.0",
  "N:E2E;ImportProbe;;;",
  "FN:E2E ImportProbe",
  "TEL;TYPE=CELL:+923009998877",
  "EMAIL;TYPE=WORK:e2e.probe@example.com",
  "END:VCARD",
  "BEGIN:VCARD",
  "VERSION:3.0",
  "N:E2E;ImportProbeTwo;;;",
  "FN:E2E ImportProbeTwo",
  "TEL;TYPE=CELL:+923009998866",
  "END:VCARD",
].join("\r\n");

/**
 * Skips (rather than fails) when the platform console is already claimed by another account:
 * this spec never resets platform users, so it cannot onboard a tenant in that case.
 */
async function skipWhenPlatformConsoleUnavailable(
  page: import("@playwright/test").Page,
): Promise<void> {
  await page.goto("/");
  await page.waitForLoadState("domcontentloaded");
  const setupEmail = page.locator("#platform-setup-email");
  const signInEmail = page.locator("#platform-email");
  await setupEmail
    .or(signInEmail)
    .first()
    .waitFor({ state: "visible", timeout: 25_000 })
    .catch(() => undefined);

  if (process.env.E2E_PLATFORM_EMAIL || (await setupEmail.isVisible().catch(() => false))) return;

  await signInEmail.fill(credentials.platformEmail);
  await page.fill("#platform-password", credentials.platformPassword);
  await page.click('button[type="submit"]');
  const rejected = await page
    .getByText(/Invalid platform credentials/i)
    .waitFor({ state: "visible", timeout: 10_000 })
    .then(() => true)
    .catch(() => false);

  test.skip(
    rejected,
    "Platform console is claimed by another account — set E2E_PLATFORM_EMAIL/E2E_PLATFORM_PASSWORD (or reset platform users) to run this spec.",
  );
}

test.describe.serial("Contacts import + export E2E", { tag: "@local-only" }, () => {
  test("imports contacts from a vCard through the header dialog and exports them as CSV", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    await skipWhenPlatformConsoleUnavailable(page);

    await bootstrapAuthenticatedTenant(page, credentials);
    await expect(page.locator("h1")).toContainText("Assalamu Alaikum");

    await page.goto(`${credentials.tenantOrigin}/contacts`);
    await page.waitForLoadState("domcontentloaded");

    // ── Import: header CTA → dialog → vCard → preview → queued batch ──────────────
    await page.getByRole("button", { name: "Import", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await expect(dialog.getByText("Upload .vcf file")).toBeVisible();

    await page.setInputFiles("#contacts-vcf-import-dialog-file-input", {
      name: "e2e-contacts.vcf",
      mimeType: "text/vcard",
      buffer: Buffer.from(VCARD, "utf8"),
    });

    await expect(dialog.getByText("2 contacts found")).toBeVisible({ timeout: 15_000 });
    await dialog.getByRole("button", { name: "Import 2 contacts" }).click();

    // The batch runs as a queued job; the dialog reports the terminal result.
    await expect(dialog.getByText("Import complete")).toBeVisible({ timeout: 60_000 });
    await expect(dialog.getByText("2 imported")).toBeVisible();

    await page.getByRole("button", { name: "Close" }).first().click();
    await expect(dialog).toBeHidden();

    // The imported contacts are in the directory.
    await expect(page.getByText("E2E ImportProbe", { exact: false }).first()).toBeVisible({
      timeout: 20_000,
    });

    // ── Export: header CTA queues the CSV job and downloads the artifact ──────────
    const download = page.waitForEvent("download", { timeout: 90_000 });
    await page.getByRole("button", { name: "Export", exact: true }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe("contacts.csv");
  });
});
