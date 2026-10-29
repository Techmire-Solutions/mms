import { expect, test, type Page } from "@playwright/test";
import { assertNoSeriousA11yViolations } from "../../helpers/a11y.js";
import { auditOverlay } from "../../helpers/a11yOverlay.js";
import {
  RESPONSIVE_VIEWPORTS,
  forceRtl,
  waitForAppShellReady,
  waitForToastsToClear,
} from "../../helpers/responsive.js";
import { bootstrapAuthenticatedTenantViaApi } from "../../helpers/tenantApiBootstrap.js";

process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "e2e-test-jwt-secret-key-at-least-32-chars-long";

const temporaryPassword = "Madrasa@1234";
const permanentPassword = "Madrasa@5678";
const platformPassword = "Pa$$w0rd123";

interface AuditRoute {
  path: string;
  label: string;
  /** Desktop overlay (dialog + drawer) audit — representative Work routes only. */
  overlay?: boolean;
}

/**
 * Every tenant app surface from `TENANT_PATHS` (`src/lib/routing/moduleRegistry.ts`).
 * A fresh E2E tenant is granted every system module, so all module routes render.
 */
const AUDIT_ROUTE_GROUPS: ReadonlyArray<{
  key: string;
  label: string;
  routes: readonly AuditRoute[];
}> = [
  {
    key: "core",
    label: "shell & core work",
    routes: [
      { path: "/", label: "dashboard (shell)" },
      { path: "/contacts", label: "contacts (Work)", overlay: true },
      { path: "/students", label: "students (Work, dense table)", overlay: true },
      { path: "/settings", label: "settings (Setup)" },
    ],
  },
  {
    key: "academic",
    label: "academic work",
    routes: [
      { path: "/faculty", label: "faculty (Work)" },
      { path: "/enrollments", label: "enrollments (Work)" },
      { path: "/sessions", label: "sessions (Work)" },
      { path: "/attendance", label: "attendance (Work)" },
      { path: "/examinations", label: "examinations (Work)", overlay: true },
      { path: "/question-bank", label: "question bank (Work)" },
    ],
  },
  {
    key: "operations",
    label: "money & records",
    routes: [
      { path: "/finance", label: "finance (Work, money)", overlay: true },
      { path: "/hasanat-cards", label: "hasanat cards (Work)" },
      { path: "/accounting", label: "accounting (Work, ledger)", overlay: true },
      { path: "/obligations", label: "obligations (Work)" },
      { path: "/tasks", label: "tasks (Work)" },
    ],
  },
  {
    key: "admin",
    label: "comms & admin",
    routes: [
      { path: "/messaging", label: "messaging (Work)", overlay: true },
      { path: "/workshops", label: "workshops (Work)" },
      { path: "/users", label: "users (Work)", overlay: true },
      { path: "/profile", label: "profile (account)" },
      { path: "/notifications", label: "notifications (account)" },
    ],
  },
];

const MAIN_CONTENT = "#main-content";

const AUDIT_VIEWPORTS = RESPONSIVE_VIEWPORTS.filter(
  (viewport) => viewport.width === 375 || viewport.width === 1440,
);

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

type AuditViewport = (typeof AUDIT_VIEWPORTS)[number];

/** Provisions a fresh tenant per test: the tests run on separate CI shards. */
async function bootstrapTenant(page: Page, tag: string): Promise<string> {
  const subdomain = `a11y${tag}${Date.now()}`;
  const tenantOrigin = `http://${subdomain}.localhost:5173`;
  const adminEmail = `admin@${subdomain}.com`;
  const platformEmail = `platform-a11y-${tag}-${Date.now()}@test.com`;
  await bootstrapAuthenticatedTenantViaApi(page, {
    subdomain,
    tenantOrigin,
    adminEmail,
    adminPassword: temporaryPassword,
    changedAdminPassword: permanentPassword,
    platformEmail,
    platformPassword,
  });
  return tenantOrigin;
}

async function auditCommandPalette(page: Page, context: string): Promise<void> {
  await test.step(`Audit Command Palette @ ${context}`, async () => {
    await page.keyboard.press(process.platform === "darwin" ? "Meta+k" : "Control+k");
    const palette = page
      .locator('[role="dialog"][aria-label*="Search" i], [role="dialog"][aria-label*="Command" i]')
      .first();
    const opened = await palette
      .waitFor({ state: "visible", timeout: 5_000 })
      .then(() => true)
      .catch(() => false);
    if (opened) {
      await assertNoSeriousA11yViolations(page, { context: `Command Palette @ ${context}` });
      await page.keyboard.press("Escape");
      await palette.waitFor({ state: "hidden", timeout: 3_000 }).catch(() => undefined);
    }
  });
}

/** LTR sweep for one route group; overlays run on the flagged desktop Work routes. */
async function ltrSweep(
  page: Page,
  tenantOrigin: string,
  viewport: AuditViewport,
  routes: readonly AuditRoute[],
): Promise<void> {
  await test.step(`LTR Sweep @ ${viewport.width}px (${viewport.name})`, async () => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });

    for (const route of routes) {
      await test.step(`Audit ${route.label} @ ${viewport.width}px`, async () => {
        const context = `${route.label} @ ${viewport.width}px (ltr)`;
        await gotoAndSettle(page, tenantOrigin, route.path, MAIN_CONTENT);
        await assertNoSeriousA11yViolations(page, { context });

        if (route.path === "/") await auditCommandPalette(page, `${viewport.width}px (ltr)`);

        if (viewport.width === 1440 && route.overlay) {
          await auditOverlay(page, context, "dialog");
          await auditOverlay(page, context, "drawer");
        }
      });
    }
  });
}

// One test per route group and viewport, each with its own tenant, so the CI
// `a11y` project's two shards can balance the work instead of one long test
// pinning a runner. 4 groups × 2 viewports = all 20 tenant routes.
test.describe("accessibility smoke @smoke", () => {
  for (const group of AUDIT_ROUTE_GROUPS) {
    for (const viewport of AUDIT_VIEWPORTS) {
      test(`${group.label} pass axe at ${viewport.width}px (LTR)`, async ({ page }) => {
        test.setTimeout(300_000);
        const tenantOrigin = await bootstrapTenant(page, `${group.key}${viewport.width}`);
        await ltrSweep(page, tenantOrigin, viewport, group.routes);
      });
    }
  }

  test("app shell and dense Work surfaces pass axe at 1440 (RTL)", async ({ page }) => {
    test.setTimeout(300_000);
    const tenantOrigin = await bootstrapTenant(page, "m");
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoAndSettle(page, tenantOrigin, "/", MAIN_CONTENT);
    await forceRtl(page, "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await assertNoSeriousA11yViolations(page, { context: "dashboard @ 1440px (rtl)" });
    await auditCommandPalette(page, "1440px (rtl)");

    // RTL overlay verification on the dense work directory
    await gotoAndSettle(page, tenantOrigin, "/students", MAIN_CONTENT);
    await forceRtl(page, "ar");
    await auditOverlay(page, "students @ 1440px (rtl)", "dialog");
    await auditOverlay(page, "students @ 1440px (rtl)", "drawer");
  });
});
