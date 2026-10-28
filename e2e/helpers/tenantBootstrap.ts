import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, type Page } from "@playwright/test";
import { loginTenant } from "./moduleTiers.js";
import { ensureE2ePlatformAdmin, setTenantAdminPassword } from "./platformAdminSeeder.js";

export { ensureE2ePlatformAdmin, setTenantAdminPassword } from "./platformAdminSeeder.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(__dirname, "../../apps/backend");

export interface TenantBootstrapCredentials {
  subdomain: string;
  tenantOrigin: string;
  adminEmail: string;
  /** Temporary password set during onboarding (forced change on first login). */
  adminPassword: string;
  /** Permanent password chosen on the force-password-change screen. */
  changedAdminPassword: string;
  platformEmail: string;
  platformPassword: string;
}

/**
 * Clears platform users so first-run setup is always available.
 * Guarded: skipped by default to preserve persistent developer accounts.
 */
export function resetPlatformUsers(): void {
  if (process.env.E2E_TARGET === "production" || process.env.NODE_ENV === "production") {
    console.warn("[E2E SAFEGUARD] Skipping platform users reset on production environment.");
    return;
  }
  if (process.env.ALLOW_RESET_PLATFORM_USERS !== "true") {
    console.log(
      "[E2E SAFEGUARD] Skipping destructive platform user reset (ALLOW_RESET_PLATFORM_USERS!=true). Using ensureE2ePlatformAdmin instead.",
    );
    return;
  }
  try {
    execSync("pnpm exec tsx src/scripts/reset-platform-users.ts", {
      cwd: backendDir,
      encoding: "utf8",
      env: {
        ...process.env,
        NODE_ENV: process.env.NODE_ENV || "test",
        JWT_SECRET: process.env.JWT_SECRET || "e2e-test-jwt-secret-key-at-least-32-chars-long",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[E2E] Failed to reset platform users:", message);
    throw err;
  }
}

/**
 * Legacy OTP helper. Platform setup now logs in directly without OTP verification.
 */
export async function completePlatformSetupOtp(page: Page): Promise<void> {
  const otpInputs = page.locator('[id^="platform-otp-"]');
  if (
    await otpInputs
      .first()
      .isVisible({ timeout: 1500 })
      .catch(() => false)
  ) {
    const devHint = page.getByRole("status").filter({ hasText: /\b\d{6}\b/ });
    await expect(devHint).toBeVisible({ timeout: 10_000 });
    const devHintText = await devHint.textContent();
    const codeMatch = devHintText?.match(/\b\d{6}\b/);
    if (codeMatch) {
      for (let index = 0; index < codeMatch[0].length; index += 1) {
        await page.fill(`#platform-otp-${index}`, codeMatch[0][index]);
      }
      await page.click('button[type="submit"]');
    }
  }
}

/**
 * Creates a platform admin, onboards one workspace, completes forced password change,
 * and leaves the browser on the authenticated tenant dashboard.
 */
export async function bootstrapAuthenticatedTenant(
  page: Page,
  credentials: TenantBootstrapCredentials,
): Promise<void> {
  const {
    subdomain,
    tenantOrigin,
    adminEmail,
    adminPassword,
    changedAdminPassword,
    platformEmail,
    platformPassword,
  } = credentials;

  ensureE2ePlatformAdmin(platformEmail, platformPassword);

  await page.goto("/");
  await page.waitForLoadState("domcontentloaded");

  const setupEmailInput = page.locator("#platform-setup-email");
  const signInEmailInput = page.locator("#platform-email");
  const platformLanding = page
    .getByRole("heading", { name: /Dashboard|Welcome back/i })
    .or(page.locator('a[href="/onboarding"]'));

  await setupEmailInput
    .or(signInEmailInput)
    .or(platformLanding)
    .first()
    .waitFor({ state: "visible", timeout: 25_000 });

  if (await setupEmailInput.isVisible()) {
    await page.fill("#platform-setup-name", "Platform Admin");
    await setupEmailInput.fill(platformEmail);
    await page.fill("#platform-setup-password", platformPassword);
    await page.click('button[type="submit"]');
  } else if (await signInEmailInput.isVisible()) {
    await signInEmailInput.fill(platformEmail);
    await page.fill("#platform-password", platformPassword);
    await page.click('button[type="submit"]');
  }

  await expect(platformLanding.first()).toBeVisible({ timeout: 20_000 });

  await page.locator('a[href="/onboarding"]:visible').first().click();
  await page.waitForURL("**/onboarding");
  await page.waitForSelector("#wizard-step-title");

  await page.fill("#onboarding-name", "Responsive Shell Madrasa");
  await page.fill("#onboarding-subdomain", subdomain);
  await expect(page.locator("text=Your URL:")).toBeVisible();

  // Step 2 Modules
  await page.getByRole("button", { name: /Continue/i }).click();
  await expect(page.locator("#wizard-step-title")).toContainText(/Modules/i);

  // Step 3 Structure (keep recommended)
  await page.getByRole("button", { name: /Continue/i }).click();
  await expect(page.locator("#wizard-step-title")).toContainText(
    /Organization structure|structure/i,
  );

  // Step 4 Admin
  await page.getByRole("button", { name: /Continue/i }).click();
  await page.waitForSelector("#firstName");

  await page.fill("#firstName", "Resp");
  await page.fill("#lastName", "Admin");
  await page.fill("#email", adminEmail);
  if (
    await page
      .locator("#password")
      .isVisible()
      .catch(() => false)
  ) {
    await page.fill("#password", adminPassword);
    await page.fill("#confirmPassword", adminPassword);
  }
  await page.check("#terms");

  // Step 5 Review + create
  await page.getByRole("button", { name: /Continue/i }).click();
  await expect(page.locator("#wizard-step-title")).toContainText(/Review|create/i);

  const platformPasswordInput = page.locator("#onboarding-platform-password");
  if (await platformPasswordInput.isVisible().catch(() => false)) {
    await platformPasswordInput.fill(platformPassword);
  }

  const createWorkspaceResponse = page
    .waitForResponse(
      (res) =>
        (res.url().includes("/api/auth/onboard") ||
          res.url().includes("/api/platform/workspaces")) &&
        res.request().method() === "POST",
      { timeout: 30_000 },
    )
    .catch(() => null);

  await page.getByRole("button", { name: /Create workspace/i }).click();
  await createWorkspaceResponse;

  await page.waitForURL((url) => !url.pathname.includes("/onboarding"), { timeout: 45_000 });
  await expect(platformLanding.first()).toBeVisible({ timeout: 30_000 });

  setTenantAdminPassword(subdomain, adminEmail, adminPassword);

  await page.goto(`${tenantOrigin}/login`);
  await page.waitForLoadState("domcontentloaded");
  await page.fill('input[name="email"]', adminEmail);
  await page.fill('input[name="password"]', adminPassword);
  await page.click('button[type="submit"]');

  await page.waitForURL(`${tenantOrigin}/force-password-change`);
  await expect(page.locator("h1")).toContainText(/temporary password|Change your/i, {
    timeout: 20_000,
  });
  await page.fill("#current-password", adminPassword);
  await page.fill("#new-password", changedAdminPassword);
  await page.fill("#confirm-password", changedAdminPassword);
  await page.click('button[type="submit"]');

  await page.waitForURL(`${tenantOrigin}/login`);
  await loginTenant(page, tenantOrigin, adminEmail, changedAdminPassword);
}
