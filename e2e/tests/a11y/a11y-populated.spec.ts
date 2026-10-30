import { expect, test, type Page } from "@playwright/test";
import { assertNoSeriousA11yViolations } from "../../helpers/a11y.js";
import { waitForAppShellReady, waitForToastsToClear } from "../../helpers/responsive.js";
import { bootstrapAuthenticatedTenantViaApi } from "../../helpers/tenantApiBootstrap.js";
import {
  seedContacts,
  seedFaculty,
  seedFacultySetup,
  seedInvoices,
  seedSessions,
  seedStudents,
} from "../../helpers/tenantOperations.js";

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
 * **gating** mode: serious/critical violations fail the build (same guard as the shell
 * sweep). It ran advisory for the first passes; now clean, it gates — see
 * `docs/a11y-baseline.md`.
 *
 * The precondition — that rows actually rendered — IS a hard assertion: a gating audit of
 * an accidentally-empty page would be a meaningless green.
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

/** Provisions a fresh tenant via the API and seeds contacts (optionally students) so surfaces render populated. */
async function bootstrapSeededTenant(
  page: Page,
  tag: string,
  options?: {
    students?: boolean;
    sessions?: boolean;
    faculty?: boolean;
    finance?: boolean;
    enrollments?: boolean;
  },
): Promise<string> {
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
  // Students reference the seeded contacts (`c-seed-dummy-*`), so contacts must be seeded first.
  if (options?.students) seedStudents(subdomain);
  if (options?.sessions) seedSessions(subdomain);
  if (options?.faculty) {
    // Faculty members reference the seeded contacts and the dept-default/desig-default catalog.
    seedFacultySetup(subdomain);
    seedFaculty(subdomain);
  }
  if (options?.finance) seedInvoices(subdomain);
  // The enrollment wizard's student picker needs seeded students (contacts first).
  if (options?.enrollments) seedStudents(subdomain);
  return tenantOrigin;
}

/**
 * Best-effort row → detail drawer audit. If the first row does not open a drawer (or its
 * first control does something else) it returns early rather than blocking the gate on an
 * interaction the shell sweep never exercised; when a drawer does open, the audit gates.
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

  await assertNoSeriousA11yViolations(page, { context: `${context} (row detail)` });
  await page.keyboard.press("Escape").catch(() => undefined);
  await drawer.waitFor({ state: "hidden", timeout: 3_000 }).catch(() => undefined);
}

test.describe("accessibility smoke — populated surfaces @smoke", () => {
  test("populated contacts directory + detail drawer @ 1440", async ({ page }) => {
    test.setTimeout(300_000);
    const tenantOrigin = await bootstrapSeededTenant(page, "d");
    await page.setViewportSize({ width: 1440, height: 900 });

    await gotoAndSettle(page, tenantOrigin, "/contacts", "#main-content");
    // Precondition: the directory is genuinely populated (else the audit is meaningless).
    await expect(page.locator("table:visible tbody tr").first()).toBeVisible({ timeout: 20_000 });

    await assertNoSeriousA11yViolations(page, {
      context: "contacts (populated table) @ 1440px",
    });
    await tryAuditRowDrawer(page, "contacts (populated) @ 1440px");

    // Dashboard metric widgets/charts are derived from the seeded contacts.
    await gotoAndSettle(page, tenantOrigin, "/", "#main-content");
    await assertNoSeriousA11yViolations(page, {
      context: "dashboard (populated metrics) @ 1440px",
    });
  });

  test("populated contacts directory @ 375", async ({ page }) => {
    test.setTimeout(300_000);
    const tenantOrigin = await bootstrapSeededTenant(page, "m");
    await page.setViewportSize({ width: 375, height: 812 });

    await gotoAndSettle(page, tenantOrigin, "/contacts", "#main-content");
    await assertNoSeriousA11yViolations(page, {
      context: "contacts (populated) @ 375px",
    });
  });

  test("populated students directory + detail drawer @ 1440", async ({ page }) => {
    test.setTimeout(300_000);
    const tenantOrigin = await bootstrapSeededTenant(page, "s", { students: true });
    await page.setViewportSize({ width: 1440, height: 900 });

    await gotoAndSettle(page, tenantOrigin, "/students", "#main-content");
    // Precondition: the directory is genuinely populated (else the audit is meaningless).
    await expect(page.locator("table:visible tbody tr").first()).toBeVisible({ timeout: 20_000 });

    await assertNoSeriousA11yViolations(page, {
      context: "students (populated table) @ 1440px",
    });
    await tryAuditRowDrawer(page, "students (populated) @ 1440px");
  });

  test("populated sessions directory + detail drawer @ 1440", async ({ page }) => {
    test.setTimeout(300_000);
    const tenantOrigin = await bootstrapSeededTenant(page, "se", { sessions: true });
    await page.setViewportSize({ width: 1440, height: 900 });

    await gotoAndSettle(page, tenantOrigin, "/sessions", "#main-content");
    // Precondition: the directory is genuinely populated (else the audit is meaningless).
    await expect(page.locator("table:visible tbody tr").first()).toBeVisible({ timeout: 20_000 });

    await assertNoSeriousA11yViolations(page, {
      context: "sessions (populated table) @ 1440px",
    });
    await tryAuditRowDrawer(page, "sessions (populated) @ 1440px");
  });

  test("populated faculty directory + detail drawer @ 1440", async ({ page }) => {
    test.setTimeout(300_000);
    const tenantOrigin = await bootstrapSeededTenant(page, "f", { faculty: true });
    await page.setViewportSize({ width: 1440, height: 900 });

    await gotoAndSettle(page, tenantOrigin, "/faculty", "#main-content");
    // Precondition: the directory is genuinely populated (else the audit is meaningless).
    await expect(page.locator("table:visible tbody tr").first()).toBeVisible({ timeout: 20_000 });

    await assertNoSeriousA11yViolations(page, {
      context: "faculty (populated table) @ 1440px",
    });
    await tryAuditRowDrawer(page, "faculty (populated) @ 1440px");
  });

  test("populated finance directory + detail drawer @ 1440", async ({ page }) => {
    test.setTimeout(300_000);
    const tenantOrigin = await bootstrapSeededTenant(page, "fi", { finance: true });
    await page.setViewportSize({ width: 1440, height: 900 });

    await gotoAndSettle(page, tenantOrigin, "/finance", "#main-content");
    // Precondition: the directory is genuinely populated (else the audit is meaningless).
    await expect(page.locator("table:visible tbody tr").first()).toBeVisible({ timeout: 20_000 });

    await assertNoSeriousA11yViolations(page, {
      context: "finance (populated table) @ 1440px",
    });
    await tryAuditRowDrawer(page, "finance (populated) @ 1440px");
  });

  test("populated dashboard @ 1440", async ({ page }) => {
    test.setTimeout(300_000);
    const tenantOrigin = await bootstrapSeededTenant(page, "da", { finance: true });
    await page.setViewportSize({ width: 1440, height: 900 });

    await gotoAndSettle(page, tenantOrigin, "/", "#main-content");
    await expect(
      page
        .locator("#main-content")
        .getByText(/Total Students|Students/i)
        .first(),
    ).toBeVisible({
      timeout: 20_000,
    });

    await assertNoSeriousA11yViolations(page, { context: "dashboard (populated) @ 1440px" });
  });

  test("new student modal @ 1440", async ({ page }) => {
    test.setTimeout(300_000);
    const tenantOrigin = await bootstrapSeededTenant(page, "st", { students: true });
    await page.setViewportSize({ width: 1440, height: 900 });

    await gotoAndSettle(page, tenantOrigin, "/students", "#main-content");
    await page.getByRole("button", { name: "Student", exact: true }).first().click();
    const dialog = page.getByRole("dialog", { name: /Register student/i });
    await expect(dialog).toBeVisible({ timeout: 20_000 });

    await assertNoSeriousA11yViolations(page, { context: "student form modal @ 1440px" });
    await page.keyboard.press("Escape").catch(() => undefined);
  });

  test("new enrollment wizard @ 1440", async ({ page }) => {
    test.setTimeout(300_000);
    const tenantOrigin = await bootstrapSeededTenant(page, "en", { enrollments: true });
    await page.setViewportSize({ width: 1440, height: 900 });

    await gotoAndSettle(page, tenantOrigin, "/enrollments", "#main-content");
    await page.getByRole("button", { name: "New Enrollment" }).first().click();
    const wizard = page.getByRole("dialog", { name: "New Enrollment" });
    await expect(wizard).toBeVisible({ timeout: 20_000 });

    await assertNoSeriousA11yViolations(page, { context: "enrollment wizard @ 1440px" });
    await page.keyboard.press("Escape").catch(() => undefined);
  });
});
