import { expect, type Page } from "@playwright/test";

const isProdTarget = process.env.E2E_TARGET === "production";

export const RESPONSIVE_VIEWPORTS = (
  isProdTarget
    ? [{ name: "desktop", width: 1440, height: 900 }]
    : [
        { name: "mobile", width: 375, height: 812 },
        { name: "tablet", width: 768, height: 1024 },
        { name: "desktop", width: 1440, height: 900 },
      ]
) as readonly { name: string; width: number; height: number }[];

export type ResponsiveViewport = (typeof RESPONSIVE_VIEWPORTS)[number];

/** Wait until the SPA has painted content into #root, so assertions are not vacuous. */
export async function waitForAppShellReady(page: Page, timeoutMs = 20_000): Promise<void> {
  await page.waitForFunction(
    () => {
      const root = document.getElementById("root");
      return Boolean(
        root && root.childElementCount > 0 && (root.textContent || "").trim().length > 0,
      );
    },
    null,
    { timeout: timeoutMs },
  );
}

export async function assertNoHorizontalOverflow(page: Page): Promise<void> {
  let layout;
  try {
    layout = await page.evaluate(() => {
      const root = document.getElementById("root");
      return {
        bodyWidth: document.body.scrollWidth,
        documentWidth: document.documentElement.scrollWidth,
        rootWidth: root?.scrollWidth ?? 0,
        viewportWidth: document.documentElement.clientWidth,
      };
    });
  } catch {
    await page.waitForLoadState("domcontentloaded");
    layout = await page.evaluate(() => {
      const root = document.getElementById("root");
      return {
        bodyWidth: document.body.scrollWidth,
        documentWidth: document.documentElement.scrollWidth,
        rootWidth: root?.scrollWidth ?? 0,
        viewportWidth: document.documentElement.clientWidth,
      };
    });
  }

  expect(layout.bodyWidth).toBeLessThanOrEqual(layout.viewportWidth + 1);
  expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth + 1);
  if (layout.rootWidth > 0) {
    expect(layout.rootWidth).toBeLessThanOrEqual(layout.viewportWidth + 1);
  }
}

export async function forceRtl(page: Page, lang = "ar"): Promise<void> {
  const forceDir = (l: string) => {
    document.documentElement.setAttribute("dir", "rtl");
    document.documentElement.setAttribute("lang", l);
    document.body.setAttribute("dir", "rtl");
    document.querySelectorAll("[dir]").forEach((element) => {
      element.setAttribute("dir", "rtl");
    });

    // Prevent theme syncs or client re-renders from breaking the dir attribute
    if (!(window as any).__rtlObserver) {
      (window as any).__rtlObserver = new MutationObserver(() => {
        if (document.documentElement.getAttribute("dir") !== "rtl") {
          document.documentElement.setAttribute("dir", "rtl");
          document.documentElement.setAttribute("lang", l);
        }
      });
      (window as any).__rtlObserver.observe(document.documentElement, { attributes: true });
    }
  };

  try {
    await page.evaluate(forceDir, lang);
  } catch {
    await page.waitForLoadState("domcontentloaded");
    await page.evaluate(forceDir, lang);
  }
  await page
    .evaluate(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        }),
    )
    .catch(() => {});
}

/** Wait for toast banners to dismiss so they do not cover shell chrome. */
export async function waitForToastsToClear(page: Page, timeoutMs = 15_000): Promise<void> {
  await page
    .waitForFunction(() => !document.querySelector('[data-state="open"]'), null, {
      timeout: timeoutMs,
    })
    .catch(() => undefined);
}

export interface TouchTargetOptions {
  /** Limit checks to controls inside these containers (CSS selector). */
  within?: string;
}

export async function assertPrimaryControlsMeetTouchTarget(
  page: Page,
  options: TouchTargetOptions = {},
): Promise<void> {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForLoadState("networkidle").catch(() => null);
  const undersized = await page.evaluate((within) => {
    const root = within ? document.querySelector(within) : document;
    if (!root)
      return [{ tag: "missing-root", text: within || "document", aria: null, width: 0, height: 0 }];

    const getTouchDimensions = (element: Element) => {
      const rect = element.getBoundingClientRect();
      const pseudoDimensions = ["::before", "::after"].map((pseudoElement) => {
        const style = window.getComputedStyle(element, pseudoElement);
        return {
          width: style.content === "none" ? 0 : Number.parseFloat(style.width) || 0,
          height: style.content === "none" ? 0 : Number.parseFloat(style.height) || 0,
        };
      });
      return {
        width: Math.max(rect.width, ...pseudoDimensions.map(({ width }) => width)),
        height: Math.max(rect.height, ...pseudoDimensions.map(({ height }) => height)),
      };
    };

    const selectors = [
      'button:not([aria-hidden="true"])',
      'a[href]:not([aria-hidden="true"])',
      '[role="button"]:not([aria-hidden="true"])',
      'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([aria-hidden="true"])',
      'select:not([aria-hidden="true"])',
      'textarea:not([aria-hidden="true"])',
    ].join(",");

    return Array.from(root.querySelectorAll(selectors))
      .filter((element) => {
        if (
          element.classList.contains("tsqd-open-btn") ||
          element.closest(
            '#tsqd-root, .tsqd-parent-container, [data-testid="react-query-devtools"]',
          )
        ) {
          return false;
        }
        const style = window.getComputedStyle(element);
        if (
          style.display === "none" ||
          style.visibility === "hidden" ||
          style.pointerEvents === "none"
        ) {
          return false;
        }
        const rect = element.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return false;

        const tag = element.tagName.toUpperCase();
        const isFormField = tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA";

        if (
          tag === "A" &&
          !element.closest('nav, header, form, [role="dialog"], [role="banner"]')
        ) {
          return false;
        }

        if (isFormField) {
          return Math.round(rect.height) < 44;
        }

        const label = (element.textContent || "").trim();
        const hasVisibleLabel = label.length > 0 || Boolean(element.getAttribute("aria-label"));
        const touchDimensions = getTouchDimensions(element);
        const width = Math.round(touchDimensions.width);
        const height = Math.round(touchDimensions.height);
        if (!hasVisibleLabel) {
          return width < 44 || height < 44;
        }
        return height < 44 || width < 44;
      })
      .map((element) => {
        const touchDimensions = getTouchDimensions(element);
        return {
          tag: element.tagName.toLowerCase(),
          text: (element.textContent || "").trim().slice(0, 40),
          aria: element.getAttribute("aria-label"),
          width: Math.round(touchDimensions.width),
          height: Math.round(touchDimensions.height),
        };
      });
  }, options.within ?? null);

  expect(undersized, `Undersized controls: ${JSON.stringify(undersized)}`).toEqual([]);
}

/** Assert every visible table is nested under a horizontal scroll / overflow wrapper. */
export async function assertVisibleTablesScrollWrapped(page: Page, context: string): Promise<void> {
  const tables = page.locator("table");
  const tableCount = await tables.count();
  for (let index = 0; index < tableCount; index += 1) {
    const table = tables.nth(index);
    if (!(await table.isVisible())) continue;
    const scrollParent = table.locator(
      'xpath=ancestor::*[contains(@class,"overflow-x-auto") or contains(@class,"overflow-auto")][1]',
    );
    await expect(
      scrollParent,
      `${context} table ${index} missing horizontal scroll wrapper`,
    ).toHaveCount(1);
  }
}
