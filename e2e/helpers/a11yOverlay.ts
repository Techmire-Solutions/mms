import { expect, type Page } from "@playwright/test";
import { assertNoSeriousA11yViolations } from "./a11y.js";

/**
 * Discovers and triggers an overlay (dialog or drawer/FormModal),
 * audits its a11y violations, verifies print styles, active focus trapping,
 * and ensures clean Escape dismissal.
 */
export async function auditOverlay(
  page: Page,
  context: string,
  kind: "dialog" | "drawer",
): Promise<boolean> {
  const mainDialogTrigger = page.locator('#main-content button[aria-haspopup="dialog"]').first();
  const primaryCta = page
    .locator(
      '[data-testid="add-record-cta"], #main-content button:has-text("Add"), #main-content button:has-text("New")',
    )
    .first();
  const rowTrigger = page.locator('table tbody tr button[aria-haspopup="menu"]').first();

  const trigger =
    kind === "dialog"
      ? (await mainDialogTrigger.count()) > 0
        ? mainDialogTrigger
        : page.locator('button[aria-haspopup="dialog"]').first()
      : (await rowTrigger.count()) > 0
        ? rowTrigger
        : primaryCta;

  if ((await trigger.count()) === 0) {
    console.log(`[a11y] ${context}: no ${kind} trigger found — skipped`);
    return false;
  }

  await trigger.click({ timeout: 3_000 }).catch(() => undefined);
  const overlay = page.locator('[role="dialog"]').first();
  let opened = await overlay
    .waitFor({ state: "visible", timeout: kind === "dialog" ? 5_000 : 3_000 })
    .then(() => true)
    .catch(() => false);

  if (!opened && kind === "drawer") {
    // A row-actions menu is the first click; the drawer (or its edit modal) is
    // behind the first menu item. Without this the audit only ever opened a
    // menu and reported "no dialog opened", so drawers went unaudited
    // (2026-10-31 review, UX-04).
    const firstItem = page.locator('[role="menu"] [role="menuitem"]').first();
    if (await firstItem.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await firstItem.click({ timeout: 3_000 }).catch(() => undefined);
      opened = await overlay
        .waitFor({ state: "visible", timeout: 3_000 })
        .then(() => true)
        .catch(() => false);
    }
  }

  if (!opened) {
    console.log(`[a11y] ${context}: ${kind} trigger present but no dialog opened — skipped`);
    return false;
  }

  // Verify focus transferred inside the overlay
  const focusInside = await overlay
    .evaluate((el) => el.contains(document.activeElement))
    .catch(() => false);
  expect(focusInside, `${context} (${kind}): active focus must move inside the overlay`).toBe(true);

  await assertNoSeriousA11yViolations(page, { context: `${context} (${kind})` });

  // Suppress overlay scrim under print media
  const backdrop = page.locator("[data-overlay-backdrop]").first();
  if ((await backdrop.count()) > 0) {
    await page.emulateMedia({ media: "print" });
    const printDisplay = await backdrop.evaluate((el) => getComputedStyle(el).display);
    await page.emulateMedia({ media: "screen" });
    expect(
      printDisplay,
      `the overlay scrim still prints under print media (display: ${printDisplay})`,
    ).toBe("none");
  }

  // Dismiss via Escape and assert clean closure
  await page.keyboard.press("Escape");
  const closed = await overlay
    .waitFor({ state: "hidden", timeout: 3_000 })
    .then(() => true)
    .catch(() => false);

  if (!closed) {
    // Attempt cleanup dismiss to avoid corrupting subsequent audits
    await page.keyboard.press("Escape").catch(() => undefined);
    const closeBtn = page
      .locator(
        '[role="dialog"] button[aria-label*="close" i], [role="dialog"] button:has-text("Cancel")',
      )
      .first();
    if ((await closeBtn.count()) > 0) {
      await closeBtn.click({ timeout: 1_000 }).catch(() => undefined);
    }
  }

  expect(closed, `${context}: ${kind} overlay failed to close on Escape`).toBe(true);
  return true;
}
