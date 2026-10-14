import { expect, test, type Page } from "@playwright/test";
import { assertNoSeriousA11yViolations } from "../../helpers/a11y.js";
import { waitForAppShellReady, waitForToastsToClear } from "../../helpers/responsive.js";
import { bootstrapAuthenticatedTenantViaApi } from "../../helpers/tenantApiBootstrap.js";
import { seedContacts } from "../../helpers/tenantOperations.js";

process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "e2e-test-jwt-secret-key-at-least-32-chars-long";

const temporaryPassword = "Madrasa@1234";
const permanentPassword = "Madrasa@5678";
const platformPassword = "Pa$$w0rd123";

/**
 * Populated-tenant a11y sweep — closes the "empty tenant" blind spot in
 * `docs/a11y-baseline.md`. The shell sweep audits an empty workspace, so data-dependent
 * markup (table rows, filter chrome, detail drawers, metric widgets) was never checked.
 *
 * The seeded tenant (20 deterministic contacts via `seed-20-contacts.ts`) is audited in
 * **advisory** mode: violations are logged + annotated, never fatal, because these
 * surfaces were never gate-audited before. Once clean, drop `advisory: true` to gate them.
 *
 * The precondition — that rows actually rendered — IS a hard assertion: an advisory audit
 * of an accidentally-empty page would be a meaningless green.
 */

async function gotoAndSettle(
  page: Page,
  origin: string,
  path: string,
  ready: string,
): Promise<void> {
  await page.goto(`${origin}${path}`);
  await page.waitForLoadState("domcontentloaded");
  await waitForAppShellReady(page);
  await page
    .locator(ready)
    .first()
    .waitFor({ state: "visible", timeout: 20_000 })
    .catch(() => undefined);
  await waitForToastsToClear(page).catch(() => undefined);
  await page
    .locator('[aria-busy="true"]')
    .waitFor({ state: "hidden", timeout: 15_000 })
    .catch(() => undefined);
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForTimeout(400);
}

/** Provisions a fresh tenant via the API and seeds 20 contacts so surfaces render populated. */
async function bootstrapSeededTenant(page: Page, tag: string): Promise<string> {
  const subdomain = `a11ypop${tag}${Date.now()}`;
  const tenantOrigin = `http://${subdomain}.localhost:5173`;
  await bootstrapAuthenticatedTenantViaApi(page, {
    subdomain,
    tenantOrigin,
    adminEmail: `admin@${subdomain}.com`,
    adminPassword: temporaryPassword,
    changedAdminPassword: permanentPassword,
    platformEmail: `platform-${subdomain}@test.com`,
    platformPassword,
  });
  seedContacts(subdomain);
  return tenantOrigin;
}

/**
 * Best-effort row → detail drawer audit. Advisory and non-failing on purpose: if the first
 * row does not open a drawer (or its first control does something else), it logs and returns
 * rather than blocking the gate on an interaction the shell sweep never exercised.
 */
async function tryAuditRowDrawer(page: Page, context: string): Promise<void> {
  const row = page.locator("table:visible tbody tr").first();
  if ((await row.count()) === 0) return;

  await row.click({ timeout: 3_000 }).catch(() => undefined);
  const drawer = page.locator('[role="dialog"]').first();
  const opened = await drawer
    .waitFor({ state: "visible", timeout: 3_000 })
    .then(() => true)
    .catch(() => false);
  if (!opened) return;

  await assertNoSeriousA11yViolations(page, { context: `${context} (row detail)`, advisory: true });
  await page.keyboard.press("Escape").catch(() => undefined);
  await drawer.waitFor({ state: "hidden", timeout: 3_000 }).catch(() => undefined);
}

test.describe("accessibility smoke — populated surfaces @smoke", () => {
  test("populated contacts directory + detail drawer @ 1440 (advisory)", async ({ page }) => {
    test.setTimeout(300_000);
    const tenantOrigin = await bootstrapSeededTenant(page, "d");
    await page.setViewportSize({ width: 1440, height: 900 });

    await gotoAndSettle(page, tenantOrigin, "/contacts", "#main-content");
    // Precondition: the directory is genuinely populated (else the audit is meaningless).
    await expect(page.locator("table:visible tbody tr").first()).toBeVisible({ timeout: 20_000 });

    await assertNoSeriousA11yViolations(page, {
      context: "contacts (populated table) @ 1440px",
      advisory: true,
    });
    await tryAuditRowDrawer(page, "contacts (populated) @ 1440px");

    // Dashboard metric widgets/charts are derived from the seeded contacts.
    await gotoAndSettle(page, tenantOrigin, "/", "#main-content");
    await assertNoSeriousA11yViolations(page, {
      context: "dashboard (populated metrics) @ 1440px",
      advisory: true,
    });
  });

  test("populated contacts directory @ 375 (advisory)", async ({ page }) => {
    test.setTimeout(300_000);
    const tenantOrigin = await bootstrapSeededTenant(page, "m");
    await page.setViewportSize({ width: 375, height: 812 });

    await gotoAndSettle(page, tenantOrigin, "/contacts", "#main-content");
    await assertNoSeriousA11yViolations(page, {
      context: "contacts (populated) @ 375px",
      advisory: true,
    });
  });
});
