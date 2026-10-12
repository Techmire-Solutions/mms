import { expect, test, type Page } from "@playwright/test";
import { assertNoSeriousA11yViolations } from "../helpers/a11y.js";
import { loginTenant } from "../helpers/moduleTiers.js";
import {
  RESPONSIVE_VIEWPORTS,
  assertNoHorizontalOverflow,
  assertPrimaryControlsMeetTouchTarget,
  forceRtl,
  waitForAppShellReady,
  waitForToastsToClear,
} from "../helpers/responsive.js";
import { bootstrapAuthenticatedTenant, resetPlatformUsers } from "../helpers/tenantBootstrap.js";

process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "e2e-test-jwt-secret-key-at-least-32-chars-long";

/**
 * Document template editor — Obligations invoice template.
 *
 * The editor had NO end-to-end coverage: every existing test for it is a
 * `renderToStaticMarkup` snapshot, which cannot see focus movement, key handling,
 * computed layout, print rules or the axe rules that matter here. The properties this
 * file guards were all invisible to those tests:
 *
 *  - keyboard selection (Enter/Space on a canvas element) — previously a no-op, because
 *    the key handler called the pointer handler, which returns early when
 *    `event.button !== 0` and a KeyboardEvent has no `button` at all;
 *  - arrow-key nudging of the selected element, end to end;
 *  - the layer list that makes 1px dividers and covered elements selectable;
 *  - the `@page` rule that gives the editing surface the template's own paper size;
 *  - 44px touch targets and a tabbed mobile layout at 375px;
 *  - axe (WCAG 2.1/2.2 A+AA, incl. `target-size`) inside the editor in LTR **and** RTL.
 *
 * Tagged `@local-only`, following `responsive-authenticated.spec.ts`: it bootstraps its
 * own tenant, and `bootstrapAuthenticatedTenant` calls `resetPlatformUsers()`, which
 * wipes platform users in the shared database. CI `grepInvert`s this tag precisely so a
 * second tenant-bootstrapping spec cannot race the platform-onboarding suite.
 */

const subdomain = `tpl${Date.now()}`;
const tenantOrigin = `http://${subdomain}.localhost:5173`;
const adminEmail = `admin@${subdomain}.com`;
const temporaryPassword = "Madrasa@1234";
const permanentPassword = "Madrasa@5678";
const platformEmail = `platform-tpl-${Date.now()}@test.com`;
const platformPassword = "Pa$$w0rd123";

/**
 * Activates a section/tier trigger regardless of breakpoint. At `>=lg` the tier and
 * sub-tab navigation renders as `role="tab"` / sidebar nav buttons; below `lg` it renders
 * as an accordion whose triggers are plain `button`s (`aria-expanded`). Waits until the
 * trigger reports itself active.
 */
async function activateSectionTrigger(page: Page, name: RegExp): Promise<void> {
  const trigger = page.getByRole("tab", { name }).or(page.getByRole("button", { name })).first();
  await expect(trigger).toBeVisible({ timeout: 30_000 });

  const isActive = async () =>
    (await trigger.getAttribute("aria-selected")) === "true" ||
    (await trigger.getAttribute("aria-expanded")) === "true";

  if (!(await isActive())) {
    await trigger.click();
    await expect.poll(isActive, { timeout: 15_000 }).toBe(true);
  }
}

/** Opens Obligations → Setup → Invoice Template and returns the editor root. */
async function openInvoiceTemplateEditor(page: Page) {
  await page.goto(`${tenantOrigin}/obligations`);
  await page.waitForLoadState("domcontentloaded");
  await waitForAppShellReady(page);

  // Tier nav (Work | Reports | Setup): horizontal tabs at >=lg, accordion triggers below.
  await activateSectionTrigger(page, /^Setup/i);
  await waitForToastsToClear(page);

  // Setup sub-tabs (… | Invoice Template): tabs at >=lg, accordion triggers below.
  await activateSectionTrigger(page, /Invoice Template/i);

  // The editor is embedded (`fullscreen={false}`) here, so it is a labelled region.
  const heading = page.getByRole("heading", { name: /Invoice Template Editor/i });
  await expect(heading).toBeVisible({ timeout: 30_000 });

  const editor = page.getByRole("region").filter({ has: heading }).first();
  return { editor, heading };
}

function propertiesPanel(page: Page) {
  // <aside aria-label="Properties"> → role=complementary.
  return page.getByRole("complementary", { name: /Properties/i }).first();
}

function canvasElements(page: Page) {
  return page.locator('[role="button"][aria-pressed]');
}

test.describe.serial("Invoice template editor", { tag: "@local-only" }, () => {
  test.beforeAll(() => {
    resetPlatformUsers();
  });

  test("bootstrap platform admin and tenant workspace", async ({ page }) => {
    test.setTimeout(180_000);
    await bootstrapAuthenticatedTenant(page, {
      subdomain,
      tenantOrigin,
      adminEmail,
      adminPassword: temporaryPassword,
      changedAdminPassword: permanentPassword,
      platformEmail,
      platformPassword,
    });
  });

  test("exposes the editor shell, paper size, and print rule", async ({ page }) => {
    test.setTimeout(90_000);
    await loginTenant(page, tenantOrigin, adminEmail, permanentPassword);
    const { editor } = await openInvoiceTemplateEditor(page);

    // Toolbar control groups are labelled (the toolbar role was removed deliberately:
    // a toolbar role without roving tabindex is a false promise).
    await expect(page.getByRole("group", { name: /History/i }).first()).toBeVisible();
    await expect(page.getByRole("group", { name: /View options/i }).first()).toBeVisible();
    await expect(page.getByRole("group", { name: /Document actions/i }).first()).toBeVisible();

    // The status pill reports the page in CSS pixels — it used to claim "pt".
    await expect(editor.getByText(/\d+ × \d+ px/).first()).toBeVisible();

    // Printing the editor must use the template's own paper size.
    const printRule = await page.evaluate(() => {
      const styles = Array.from(document.querySelectorAll("style"));
      const printStyle = styles.find((s) => s.textContent?.includes("@page"));
      return printStyle ? printStyle.textContent : null;
    });
    expect(printRule).toMatch(/@page\s*\{\s*size:\s*\d+px\s+\d+px\s+(portrait|landscape)/);
  });

  test("selects and nudges an element with the keyboard only", async ({ page }) => {
    test.setTimeout(90_000);
    await loginTenant(page, tenantOrigin, adminEmail, permanentPassword);
    await openInvoiceTemplateEditor(page);

    const panel = propertiesPanel(page);
    // Nothing is selected yet, so the inspector shows the layer list as the way in.
    await expect(panel.getByRole("heading", { name: /Layers/i }).first()).toBeVisible();
    await panel.locator("li button").first().click();

    const xField = panel.getByLabel(/Horizontal \(X\)/i).first();
    await expect(xField).toBeVisible();
    const before = Number(await xField.inputValue());

    // Focus the same element on the canvas and nudge it with the arrow keys. Before the
    // fix the element could not even be selected from the keyboard.
    const element = canvasElements(page).first();
    await element.focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("ArrowRight");

    await expect
      .poll(async () => Number(await xField.inputValue()), { timeout: 5_000 })
      .toBeGreaterThan(before);
  });

  test("layer list reaches elements that cannot be clicked on the canvas", async ({ page }) => {
    test.setTimeout(90_000);
    await loginTenant(page, tenantOrigin, adminEmail, permanentPassword);
    await openInvoiceTemplateEditor(page);

    const panel = propertiesPanel(page);
    const layerRows = panel.locator("li button");
    const rowCount = await layerRows.count();
    expect(rowCount, "the shipped presets place 20+ elements on the page").toBeGreaterThan(5);

    // A 1px divider is essentially unhittable with a pointer; the list is its path.
    const dividerRow = panel.locator("li button", { hasText: /divider/ }).first();
    if (await dividerRow.count()) {
      await dividerRow.click();
      await expect(panel.getByLabel(/Height \(H\)/i).first()).toHaveValue(/^[0-9.]+$/);
    }
  });

  for (const viewport of RESPONSIVE_VIEWPORTS) {
    test(`${viewport.name} (${viewport.width}px) editor layout and touch targets`, async ({
      page,
    }) => {
      test.setTimeout(90_000);
      await loginTenant(page, tenantOrigin, adminEmail, permanentPassword);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const { editor } = await openInvoiceTemplateEditor(page);

      await assertNoHorizontalOverflow(page);

      if (viewport.width < 1024) {
        // Below `lg` the panes are tabs; the canvas is the default pane and the
        // inspector is one tap away instead of pushing the canvas out of the box.
        await expect(page.getByRole("tab", { name: "Elements" }).first()).toBeVisible();
        await expect(page.getByRole("tab", { name: "Canvas" }).first()).toBeVisible();
        await page.getByRole("tab", { name: "Properties" }).first().click();
        await expect(propertiesPanel(page)).toBeVisible();
      } else {
        await expect(editor.getByText(/\d+ × \d+ px/).first()).toBeVisible();
      }

      await assertPrimaryControlsMeetTouchTarget(page, {
        within: 'aside[aria-label*="Properties"], [role="complementary"]',
      });
    });

    test(`${viewport.name} (${viewport.width}px) editor axe audit (LTR + RTL)`, async ({
      page,
    }) => {
      test.setTimeout(120_000);
      await loginTenant(page, tenantOrigin, adminEmail, permanentPassword);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const { editor } = await openInvoiceTemplateEditor(page);

      await assertNoSeriousA11yViolations(page, {
        context: `invoice template editor @ ${viewport.width}px LTR`,
      });

      await forceRtl(page);
      await expect(editor).toBeVisible();
      await assertNoHorizontalOverflow(page);
      await assertNoSeriousA11yViolations(page, {
        context: `invoice template editor @ ${viewport.width}px RTL`,
      });
    });
  }
});
