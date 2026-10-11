import { expect, type Page } from "@playwright/test";

const TIER_LABELS = ["Work", "Reports", "Setup"] as const;

/**
 * Visits a tenant module and asserts Work / Reports / Setup tier tabs switch.
 * Assumes the page is already authenticated on the tenant host.
 */
export async function assertModuleTierSmoke(
  page: Page,
  modulePath: string,
  tenantOrigin: string,
): Promise<void> {
  await page.goto(`${tenantOrigin}${modulePath}`);
  await page.waitForLoadState("domcontentloaded");

  const desktopNav = page
    .locator("div.hidden.lg\\:block")
    .filter({
      has: page
        .getByRole("tab", { name: "Work", exact: true })
        .or(page.getByRole("button", { name: "Work", exact: true })),
    })
    .first();
  await expect(desktopNav, `${modulePath} missing desktop tier nav`).toBeVisible({
    timeout: 20_000,
  });

  for (const label of TIER_LABELS) {
    const tab = desktopNav
      .getByRole("tab", { name: label, exact: true })
      .or(desktopNav.getByRole("button", { name: label, exact: true }));
    await expect(tab, `${modulePath} missing ${label} tab`).toBeVisible();
    await tab.click();
    await expect(tab).toBeVisible();
  }

  const workTab = desktopNav
    .getByRole("tab", { name: "Work", exact: true })
    .or(desktopNav.getByRole("button", { name: "Work", exact: true }));
  await workTab.click();
  await page.waitForLoadState("domcontentloaded");
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

  const retryBtn = page.getByRole("button", { name: /Try again/i });
  if (await retryBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await retryBtn.click().catch(() => {});
  }

  await emailInput.or(dashboardHeading).first().waitFor({ state: "visible", timeout: 30_000 });

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
