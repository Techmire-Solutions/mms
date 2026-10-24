import { expect, test, type Page } from "@playwright/test";
import {
  RESPONSIVE_VIEWPORTS,
  assertNoHorizontalOverflow,
  assertPrimaryControlsMeetTouchTarget,
  forceRtl,
  waitForAppShellReady,
} from "../../helpers/responsive.js";

const APEX_READY =
  '#platform-setup-email, #platform-email, a[href*="login"], button:has-text("Sign"), #main-content';

function getTenantOrigin(subdomain: string, baseURL?: string): string {
  const base = new URL(baseURL || "http://localhost:5173");
  const host = base.hostname === "127.0.0.1" ? "localhost" : base.hostname;
  base.hostname = `${subdomain}.${host}`;
  return base.origin;
}

const PUBLIC_ROUTES: readonly { path: string; ready?: string; checkTouch?: boolean }[] = [
  { path: "/", ready: APEX_READY, checkTouch: true },
  {
    path: "/platform/forgot-password",
    ready: 'form, input[type="email"], #email, button',
    checkTouch: true,
  },
  { path: "/contacts", ready: 'main, #main-content, h1, [role="main"]', checkTouch: true },
];

async function openPublicRoute(page: Page, url: string, ready?: string): Promise<void> {
  await page.goto(url);
  await waitForAppShellReady(page);
  if (ready) {
    const readyLocator = page.locator(ready).first();
    try {
      await expect(readyLocator).toBeVisible({ timeout: 20_000 });
    } catch (err) {
      const retryBtn = page.getByRole("button", { name: /Try again/i });
      if (await retryBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
        await retryBtn.click();
        await expect(readyLocator).toBeVisible({ timeout: 20_000 });
      } else {
        throw err;
      }
    }
  }
}

test.describe("Unknown tenant host redirect", { tag: "@smoke" }, () => {
  test("hard-redirects unregistered subdomain to apex tenant-not-found", async ({
    page,
    baseURL,
  }) => {
    const missingSubdomain = `missing${Date.now()}`;
    const targetUrl = `${getTenantOrigin(missingSubdomain, baseURL)}/settings`;

    await page.goto(targetUrl, { waitUntil: "commit" }).catch(() => {});
    await expect
      .poll(
        async () => {
          try {
            if (page.url() === "about:blank") {
              await page.goto(targetUrl, { timeout: 5000, waitUntil: "commit" }).catch(() => {});
            }
            const retryBtn = page.getByRole("button", { name: /Try again/i });
            if (await retryBtn.isVisible().catch(() => false)) {
              await retryBtn.click().catch(() => {});
            }
            const parsed = new URL(page.url());
            return (
              parsed.pathname === "/tenant-not-found" &&
              parsed.searchParams.get("subdomain") === missingSubdomain
            );
          } catch {
            return false;
          }
        },
        { timeout: 45_000, intervals: [500, 1000, 2000] },
      )
      .toBe(true);

    await expect(page.getByRole("heading", { name: /Tenant does not exist/i })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText(new RegExp(`${missingSubdomain}\\.`, "i")).first()).toBeVisible();
  });
});

test.describe("Public shell responsive layout", { tag: "@smoke" }, () => {
  for (const viewport of RESPONSIVE_VIEWPORTS) {
    for (const route of PUBLIC_ROUTES) {
      test(`${viewport.name} (${viewport.width}px) ${route.path} layout & touch targets`, async ({
        page,
      }) => {
        await page.setViewportSize(viewport);
        await openPublicRoute(page, route.path, route.ready);
        await assertNoHorizontalOverflow(page);
        if (route.checkTouch) {
          await assertPrimaryControlsMeetTouchTarget(page);
        }
      });

      test(`${viewport.name} (${viewport.width}px) RTL ${route.path} has no horizontal overflow`, async ({
        page,
      }) => {
        await page.setViewportSize(viewport);
        await openPublicRoute(page, route.path, route.ready);
        await forceRtl(page);
        await assertNoHorizontalOverflow(page);
      });
    }

    test(`${viewport.name} (${viewport.width}px) tenant login shell responsive and touch targets`, async ({
      page,
      baseURL,
    }) => {
      const tenantLoginUrl = `${getTenantOrigin("responsive-shell", baseURL)}/login`;
      await page.setViewportSize(viewport);
      await openPublicRoute(page, tenantLoginUrl);
      await assertNoHorizontalOverflow(page);
      await assertPrimaryControlsMeetTouchTarget(page);

      await forceRtl(page);
      await assertNoHorizontalOverflow(page);
    });
  }
});
