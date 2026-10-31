import { expect, test, type Page } from "@playwright/test";
import { loginTenant } from "../../helpers/moduleTiers.js";
import {
  RESPONSIVE_VIEWPORTS,
  assertNoHorizontalOverflow,
  assertPrimaryControlsMeetTouchTarget,
  assertVisibleTablesScrollWrapped,
  forceRtl,
  waitForToastsToClear,
} from "../../helpers/responsive.js";
import {
  bootstrapAuthenticatedTenant,
  ensureE2ePlatformAdmin,
} from "../../helpers/tenantBootstrap.js";

process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "e2e-test-jwt-secret-key-at-least-32-chars-long";

const subdomain = `resp${Date.now()}`;
const tenantOrigin = `http://${subdomain}.localhost:5173`;
const adminEmail = `admin@${subdomain}.com`;
const temporaryPassword = "Madrasa@1234";
const permanentPassword = "Madrasa@5678";
const platformEmail = `platform-resp-${Date.now()}@test.com`;
const platformPassword = "Pa$$w0rd123";

/** Primary tenant module work/shell routes — swept once per viewport after a single login. */
const MODULE_ROUTES = [
  {
    path: "/contacts",
    ready: 'button:has-text("Contact"), [role="tab"], #main-content',
  },
  {
    path: "/students",
    ready: '#main-content button:has-text("Student"), #main-content [role="tab"]',
  },
  {
    path: "/attendance",
    ready: '#filter-class, button:has-text("Submit Attendance"), #main-content',
  },
  {
    path: "/sessions",
    ready: 'button:has-text("New session"), [role="tab"], #main-content',
  },
  {
    path: "/faculty",
    ready: 'button:has-text("Faculty"), button:has-text("Teacher"), [role="tab"], #main-content',
  },
  {
    path: "/settings",
    ready: 'h1:has-text("Settings"), #main-content',
  },
  {
    path: "/messaging",
    ready: 'button:has-text("Work"), button:has-text("Setup"), #main-content',
  },
  {
    path: "/finance",
    ready: 'button:has-text("New Invoice"), [role="tab"], #main-content',
  },
  {
    path: "/accounting",
    ready: '[role="tab"], button:has-text("Work"), #main-content',
  },
  {
    path: "/enrollments",
    ready:
      'button:has-text("New Enrollment"), button:has-text("Enroll"), [role="tab"], #main-content',
  },
  {
    path: "/users",
    ready: 'button:has-text("User"), [role="tab"], #main-content',
  },
  {
    path: "/hasanat-cards",
    ready: "h1",
  },
  {
    path: "/examinations",
    ready: "h1",
  },
  {
    path: "/question-bank",
    ready: "h1",
  },
  {
    path: "/obligations",
    ready: "h1",
  },
  {
    path: "/profile",
    ready: "h1",
  },
] as const;

async function loginAndSetViewport(
  page: Page,
  viewport: { width: number; height: number },
): Promise<void> {
  await loginTenant(page, tenantOrigin, adminEmail, permanentPassword);
  await page.setViewportSize(viewport);
}

async function gotoReadyRoute(page: Page, path: string, ready?: string): Promise<void> {
  const targetUrl = `${tenantOrigin}${path}`;
  if (page.url() !== targetUrl && page.url() !== `${targetUrl}/`) {
    await page.goto(targetUrl);
    await page.waitForLoadState("domcontentloaded");
  }
  await expect(page.locator("#main-content")).toBeVisible({ timeout: 25_000 });
  if (ready) {
    await expect(page.locator(ready).first()).toBeVisible({ timeout: 25_000 });
  }
}

/**
 * Quick-filter presets must never squeeze their labels: at 375px a six-preset
 * tray rendered 45–57px buttons for 62–108px labels and they superimposed
 * (2026-10-31 review). With the shared primitive's `shrink-0` + scroller each
 * button fits its own text; the tray may still scroll horizontally.
 */
async function assertQuickFilterLabelsFit(page: Page): Promise<void> {
  const clipped = await page.evaluate(() => {
    const offenders: string[] = [];
    document.querySelectorAll<HTMLElement>('[role="group"]').forEach((group) => {
      const buttons = Array.from(group.querySelectorAll<HTMLButtonElement>("button[aria-pressed]"));
      if (buttons.length < 2) return;
      for (const button of buttons) {
        if (button.scrollWidth > button.clientWidth + 1) {
          offenders.push(
            `${(button.textContent ?? "").trim().slice(0, 28)}: ${button.clientWidth}px for ${button.scrollWidth}px`,
          );
        }
      }
    });
    return offenders;
  });
  expect(clipped, "quick-filter labels must not be squeezed below their text width").toEqual([]);
}

/** Sortable header cells need a >= 44px hit area (button box or ::after overlay). */
async function assertSortTargetsMeetMinimum(page: Page): Promise<void> {
  const undersized = await page.evaluate(() => {
    const offenders: string[] = [];
    document.querySelectorAll<HTMLButtonElement>("table thead th button").forEach((button) => {
      const rect = button.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;
      const pseudoHeights = ["::before", "::after"].map((pseudo) => {
        const style = window.getComputedStyle(button, pseudo);
        return style.content === "none" ? 0 : Number.parseFloat(style.height) || 0;
      });
      const height = Math.max(rect.height, ...pseudoHeights);
      if (height < 44) {
        offenders.push(
          `${(button.textContent ?? "").trim().slice(0, 24)}: ${Math.round(height)}px`,
        );
      }
    });
    return offenders;
  });
  expect(undersized, "sort header targets must expose a 44px hit area").toEqual([]);
}

/**
 * Work-directory cards must lay their metadata out two-up on phones too: a
 * single column made a 7-tile card's metadata 407 px tall and dominated the
 * mobile feed (2026-10-31 review, UX-17). Only checked when cards are rendered
 * (tables are used at desktop widths).
 */
async function assertCardMetaGridDensity(page: Page): Promise<void> {
  const grids = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("[data-card-meta-grid]")]
      .filter((grid) => grid.offsetParent !== null)
      .slice(0, 3)
      .map((grid) => ({
        tracks: getComputedStyle(grid).gridTemplateColumns.split(" ").filter(Boolean).length,
        tiles: grid.children.length,
      })),
  );
  for (const grid of grids) {
    if (grid.tiles < 2) continue;
    expect(grid.tracks, `card metadata grid with ${grid.tiles} tiles must render 2 columns`).toBe(
      2,
    );
  }
}

async function assertModuleRouteLayout(page: Page, path: string, ready: string): Promise<void> {
  await gotoReadyRoute(page, path, ready);
  if ((page.viewportSize()?.width ?? 0) < 1024) {
    // Persisted tabs used to scroll the document to the tab panel on mount,
    // hiding the page title and KPIs. A freshly opened module must start at 0.
    expect(await page.evaluate(() => Math.round(window.scrollY))).toBe(0);
  }
  await assertNoHorizontalOverflow(page);
  await assertPrimaryControlsMeetTouchTarget(page, { within: "#main-content" });
  await assertVisibleTablesScrollWrapped(page, path);
  await assertQuickFilterLabelsFit(page);
  await assertSortTargetsMeetMinimum(page);
  await assertCardMetaGridDensity(page);
}

test.describe.serial("Authenticated tenant shell responsive layout", { tag: "@local-only" }, () => {
  test.beforeAll(() => {
    ensureE2ePlatformAdmin(platformEmail, platformPassword);
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

  for (const viewport of RESPONSIVE_VIEWPORTS) {
    test(`${viewport.name} (${viewport.width}px) dashboard has no horizontal overflow`, async ({
      page,
    }) => {
      test.setTimeout(120_000);
      await loginAndSetViewport(page, viewport);
      await gotoReadyRoute(page, "/");
      await expect(page.locator("h1")).toContainText("Assalamu Alaikum", { timeout: 20_000 });
      await assertNoHorizontalOverflow(page);
    });

    test(`${viewport.name} (${viewport.width}px) RTL dashboard has no horizontal overflow`, async ({
      page,
    }) => {
      test.setTimeout(120_000);
      await loginAndSetViewport(page, viewport);
      await gotoReadyRoute(page, "/");
      await expect(page.locator("h1")).toContainText("Assalamu Alaikum", { timeout: 20_000 });
      await forceRtl(page);
      await assertNoHorizontalOverflow(page);
    });

    test(`${viewport.name} (${viewport.width}px) shell chrome meets 44px and mobile nav rules`, async ({
      page,
    }) => {
      test.setTimeout(120_000);
      await loginAndSetViewport(page, viewport);
      await gotoReadyRoute(page, "/");

      const openMenu = page.getByRole("button", { name: "Open navigation menu" });

      if (viewport.width < 1024) {
        await expect(openMenu).toBeVisible();
        const menuBox = await openMenu.boundingBox();
        expect(menuBox, "open-menu bounding box").toBeTruthy();
        expect(menuBox!.width).toBeGreaterThanOrEqual(44);
        expect(menuBox!.height).toBeGreaterThanOrEqual(44);

        await waitForToastsToClear(page);
        await openMenu.click();
        const drawer = page.getByRole("dialog");
        await expect(drawer).toBeVisible();
        await assertPrimaryControlsMeetTouchTarget(page, { within: '[role="dialog"]' });
        await page.keyboard.press("Escape");
        await expect(drawer).toBeHidden({ timeout: 5_000 });
      } else {
        await waitForToastsToClear(page);
        await expect(openMenu).toBeHidden();
        await assertPrimaryControlsMeetTouchTarget(page, { within: "header" });
      }

      await assertNoHorizontalOverflow(page);
    });

    test(`${viewport.name} (${viewport.width}px) module work views satisfy responsive layout checks`, async ({
      page,
    }) => {
      test.setTimeout(180_000);
      await loginAndSetViewport(page, viewport);
      for (const route of MODULE_ROUTES) {
        await assertModuleRouteLayout(page, route.path, route.ready);
      }
    });

    test(`${viewport.name} (${viewport.width}px) contacts Reports and Setup stay within viewport`, async ({
      page,
    }) => {
      test.setTimeout(90_000);
      await loginAndSetViewport(page, viewport);
      await gotoReadyRoute(
        page,
        "/contacts",
        'button:has-text("Contact"), [role="tab"], #main-content',
      );

      const reportsTab = page
        .getByRole("tab", { name: /Reports/i })
        .or(page.getByRole("button", { name: /Reports/i }));
      if (
        await reportsTab
          .first()
          .isVisible()
          .catch(() => false)
      ) {
        await reportsTab.first().click();
        await page.waitForLoadState("domcontentloaded");
        await assertNoHorizontalOverflow(page);
        await assertPrimaryControlsMeetTouchTarget(page, { within: "#main-content" });
      }

      const setupTab = page
        .getByRole("tab", { name: /Setup/i })
        .or(page.getByRole("button", { name: /Setup/i }));
      if (
        await setupTab
          .first()
          .isVisible()
          .catch(() => false)
      ) {
        await setupTab.first().click();
        await page.waitForLoadState("domcontentloaded");
        await assertNoHorizontalOverflow(page);
        await assertPrimaryControlsMeetTouchTarget(page, { within: "#main-content" });
      }
    });

    test(`${viewport.name} (${viewport.width}px) RTL module work views have no horizontal overflow`, async ({
      page,
    }) => {
      test.setTimeout(180_000);
      await loginAndSetViewport(page, viewport);
      for (const route of MODULE_ROUTES) {
        await gotoReadyRoute(page, route.path, route.ready);
        await forceRtl(page);
        await assertNoHorizontalOverflow(page);
      }
    });
  }
});
