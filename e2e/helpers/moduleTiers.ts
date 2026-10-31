import { expect, type Page } from "@playwright/test";

/**
 * Visits a tenant module and asserts its section/tier navigation renders and every
 * tab is selectable. Tier labels are module-specific (e.g. Faculty exposes
 * Faculties/Designations/Reports/Setup, Accounting exposes Work/Reports/Setup), so
 * this checks the nav exists, has at least two tabs, and each tab can be activated —
 * without hardcoding labels.
 *
 * The nav is rendered by `ResponsiveAccordionTabs`, which emits a `role="tablist"`
 * (horizontal layout) or a `<nav>` (sidebar layout), both labelled "Section navigation".
 * Assumes the page is already authenticated on the tenant host.
 */
export async function assertModuleTierSmoke(
  page: Page,
  modulePath: string,
  tenantOrigin: string,
): Promise<void> {
  await page.goto(`${tenantOrigin}${modulePath}`);
  await expect(page.locator("h1").first(), `${modulePath} missing h1`).toBeVisible({
    timeout: 20_000,
  });

  const tierNav = page
    .getByRole("tablist", { name: "Section navigation" })
    .or(page.getByRole("navigation", { name: "Section navigation" }))
    .first();
  await expect(tierNav, `${modulePath} missing tier nav`).toBeVisible({ timeout: 20_000 });

  const tierTabs = tierNav.locator('[role="tab"], button');
  const tabCount = await tierTabs.count();
  expect(tabCount, `${modulePath} tier nav has no tabs`).toBeGreaterThanOrEqual(2);

  for (let index = 0; index < tabCount; index += 1) {
    const tab = tierTabs.nth(index);
    await expect(tab, `${modulePath} tier tab ${index} not visible`).toBeVisible();
    const currentSelected = await tab.getAttribute("aria-selected");
    if (currentSelected !== "true") {
      await tab.click();
    }
    const isSelected = await tab.getAttribute("aria-selected");
    if (isSelected !== null) {
      await expect(tab, `${modulePath} tier tab ${index} not selected`).toHaveAttribute(
        "aria-selected",
        "true",
        { timeout: 10_000 },
      );
    }
  }

  const firstTab = tierTabs.first();
  const currentFirstSelected = await firstTab.getAttribute("aria-selected");
  if (currentFirstSelected !== "true") {
    await firstTab.click();
  }
  const firstSelected = await firstTab.getAttribute("aria-selected");
  if (firstSelected !== null) {
    await expect(firstTab, `${modulePath} reset to first tab failed`).toHaveAttribute(
      "aria-selected",
      "true",
      { timeout: 10_000 },
    );
  }
}

export async function completeInstitutionSetupIfPresent(page: Page): Promise<void> {
  const institutionHeading = page.getByRole("heading", {
    name: /Institution Profile|Complete Institution/i,
  });
  const dashboardHeading = page.getByRole("heading", { name: /Assalamu Alaikum/i });

  // Wait for either the dashboard or the setup page to appear after login
  const isSetup = await institutionHeading
    .or(dashboardHeading)
    .first()
    .waitFor({ state: "visible", timeout: 30_000 })
    .then(async () => await institutionHeading.isVisible())
    .catch(() => false);

  if (isSetup) {
    const defaultSetupFields: Array<{ selector: string; defaultValue: string }> = [
      { selector: "#setup-madrasaName", defaultValue: "Responsive Shell Madrasa" },
      { selector: "#setup-tagline", defaultValue: "Excellence in Islamic Education" },
      { selector: "#setup-email", defaultValue: "admin@madrasa.org" },
      { selector: "#setup-phone", defaultValue: "03001234567" },
      { selector: "#setup-addressLine1", defaultValue: "123 Madrasa Street" },
      { selector: "#setup-city", defaultValue: "London" },
      { selector: "#setup-postalCode", defaultValue: "E1 6AN" },
      { selector: "#setup-country", defaultValue: "United Kingdom" },
    ];

    for (const { selector, defaultValue } of defaultSetupFields) {
      const fieldInput = page.locator(selector);
      if (await fieldInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        if (!(await fieldInput.inputValue())) {
          await fieldInput.fill(defaultValue);
        }
      }
    }

    await page.getByRole("button", { name: /Save|Complete|Submit/i }).click();
    await expect(dashboardHeading).toBeVisible({ timeout: 30_000 });
    await page.waitForLoadState("domcontentloaded");
  }
}

/**
 * Signs into an existing tenant workspace with email/password.
 * If a shared storageState already lands on the dashboard, skips the form.
 */
export async function loginTenant(
  page: Page,
  tenantOrigin: string,
  email: string,
  password: string,
): Promise<void> {
  await page.goto(`${tenantOrigin}/login`);
  await page.waitForLoadState("domcontentloaded");

  const emailInput = page.locator('input[name="email"]');
  const dashboardHeading = page.getByRole("heading", { name: /Assalamu Alaikum/i });

  if (await dashboardHeading.isVisible().catch(() => false)) {
    return;
  }

  const retryBtn = page.getByRole("button", { name: /Try again|Retry/i });
  if (await retryBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await retryBtn.click().catch(() => {});
  }

  const loginEntry = emailInput.or(dashboardHeading).first();
  try {
    await loginEntry.waitFor({ state: "visible", timeout: 30_000 });
  } catch {
    // Cold-start dev-server navigation: Vite can spend the whole wait optimising
    // dependencies and leave the SPA on its loading shell. One reload recovers
    // (2026-10-31 review, README §8 — this masqueraded as a dozen product failures).
    await page.reload({ waitUntil: "domcontentloaded" }).catch(() => undefined);
    await loginEntry.waitFor({ state: "visible", timeout: 60_000 });
  }

  if (await dashboardHeading.isVisible().catch(() => false)) {
    await completeInstitutionSetupIfPresent(page);
    await expect(dashboardHeading).toBeVisible({ timeout: 10_000 });
    return;
  }

  await expect(emailInput).toBeVisible({ timeout: 10_000 });
  await emailInput.fill(email);
  await page.fill('input[name="password"]', password);

  const loginResponse = page
    .waitForResponse(
      (res) => res.url().includes("/api/auth/login") && res.request().method() === "POST",
      { timeout: 20_000 },
    )
    .catch(() => null);

  await page.click('button[type="submit"]');
  await loginResponse;

  await completeInstitutionSetupIfPresent(page);

  await expect(dashboardHeading).toBeVisible({ timeout: 30_000 });
  await page.waitForLoadState("domcontentloaded");
}
