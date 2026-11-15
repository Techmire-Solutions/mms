import { test, expect } from "@playwright/test";
import {
  bootstrapAuthenticatedTenant,
  resetPlatformUsers,
  type TenantBootstrapCredentials,
} from "../../helpers/tenantBootstrap.js";

process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "e2e-test-jwt-secret-key-at-least-32-chars-long";

/**
 * Regression: the tenant login page used to call `GET /api/auth/me` and log a 401 whenever the
 * 15-minute access cookie had expired but the 7-day `csrf_token` indicator remained. The boot
 * probe is now `GET /api/auth/session` (200/null), and an expired access session is recovered
 * through `/api/auth/refresh` instead of being treated as logged out.
 */
test.describe.serial("Tenant login session probe", { tag: "@local-only" }, () => {
  test("never 401s a guest on /login and recovers an expired access cookie", async ({
    page,
    browser,
  }, testInfo) => {
    test.setTimeout(270_000);
    resetPlatformUsers();

    const subdomain = `loginprobe${Date.now()}-${testInfo.retry}`;
    const credentials: TenantBootstrapCredentials = {
      subdomain,
      tenantOrigin: `http://${subdomain}.localhost:5173`,
      adminEmail: `admin@${subdomain}.com`,
      adminPassword: "Madrasa@1234",
      changedAdminPassword: "Madrasa@5678",
      platformEmail: `platform-${subdomain}@test.com`,
      platformPassword: "Pa$$w0rd123",
    };

    await bootstrapAuthenticatedTenant(page, credentials);
    await expect(page.locator("h1")).toContainText("Assalamu Alaikum");

    // ── 1. Fresh guest: no boot probe at all, no 401 ────────────────────────────────────────
    const guest = await browser.newContext();
    const guestPage = await guest.newPage();
    const authRequests: string[] = [];
    const authResponses: Array<{ url: string; status: number }> = [];
    guestPage.on("request", (request) => {
      const url = request.url();
      if (url.startsWith(credentials.tenantOrigin) && url.includes("/api/auth/")) {
        authRequests.push(url);
      }
    });
    guestPage.on("response", (response) => {
      const url = response.url();
      if (url.startsWith(credentials.tenantOrigin) && url.includes("/api/auth/")) {
        authResponses.push({ url, status: response.status() });
      }
    });

    await guestPage.goto(`${credentials.tenantOrigin}/login`, { waitUntil: "domcontentloaded" });
    await expect(guestPage.locator('input[name="email"]')).toBeVisible({ timeout: 30_000 });

    expect(authResponses.filter((response) => response.status === 401)).toEqual([]);
    expect(authRequests.some((url) => url.endsWith("/api/auth/me"))).toBe(false);
    // No persisted identity and no cookie: `useAuthSessionSync` skips the probe entirely.
    expect(authRequests.some((url) => url.endsWith("/api/auth/session"))).toBe(false);

    // ── 2. Stale csrf only: one 200 soft probe, still no 401 and no /auth/me ────────────────
    await guest.addCookies([
      {
        name: "csrf_token",
        value: "stale-csrf-token",
        domain: new URL(credentials.tenantOrigin).hostname,
        path: "/",
        httpOnly: false,
        secure: false,
        sameSite: "Lax",
      },
    ]);
    authRequests.length = 0;
    authResponses.length = 0;
    await guestPage.reload({ waitUntil: "domcontentloaded" });
    await expect(guestPage.locator('input[name="email"]')).toBeVisible({ timeout: 30_000 });
    await expect
      .poll(
        () => authResponses.find((response) => response.url.endsWith("/api/auth/session"))?.status,
      )
      .toBe(200);
    expect(authResponses.filter((response) => response.status === 401)).toEqual([]);
    expect(authRequests.some((url) => url.endsWith("/api/auth/me"))).toBe(false);
    expect(authRequests.some((url) => url.endsWith("/api/auth/refresh"))).toBe(false);
    await guest.close();

    // ── 3. Access cookie expired: refresh recovers the session instead of a forced logout ──
    const context = page.context();
    const cookies = await context.cookies();
    const refreshStatuses: number[] = [];
    page.on("response", (response) => {
      if (response.url().endsWith("/api/auth/refresh")) {
        refreshStatuses.push(response.status());
      }
    });
    await context.clearCookies();
    await context.addCookies(cookies.filter((cookie) => cookie.name !== "mms_access"));

    await page.goto(`${credentials.tenantOrigin}/`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /Assalamu Alaikum/i })).toBeVisible({
      timeout: 30_000,
    });
    expect(refreshStatuses).toContain(200);
  });
});
