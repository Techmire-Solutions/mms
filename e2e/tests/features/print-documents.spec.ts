import { expect, test } from "@playwright/test";

process.env.NODE_ENV = process.env.NODE_ENV || "test";

/**
 * What actually prints.
 *
 * The global `@media print` block used to hide `.shadow-sm` and `.shadow-xl`
 * outright. Printable content carries those classes, so it silently vanished on
 * paper: `.id-card-preview` (student/teacher ID cards) is `shadow-sm`, `Card`'s base
 * class is `shadow-sm`, and so is the dashboard's setup callout. The same block left
 * the full-viewport `bg-sidebar/90` overlay scrim visible while
 * `print-color-adjust: exact` forced it to render, so the page also came out dark.
 *
 * No unit test could see any of this: it is a cascade question and jsdom does not
 * resolve `@media print`. `page.emulateMedia({ media: 'print' })` is the lever — it
 * makes the print rules apply, so the assertion reads the computed style the printer
 * would use. That turns "does this print?" into a deterministic check instead of a
 * manual print-to-PDF ritual.
 *
 * DELIBERATELY UNAUTHENTICATED AND TENANT-FREE. The property under test is global
 * CSS, so any rendered page will do — and bootstrapping a tenant here is actively
 * harmful: `bootstrapAuthenticatedTenant` calls `resetPlatformUsers()`, which wipes
 * platform users in the shared database, and the config runs `fullyParallel` with 2
 * workers in CI. A second tenant-bootstrapping spec races the a11y spec. That is not
 * hypothetical — it is what this file did on its first attempt, hanging for its full
 * 5-minute timeout when run beside `a11y-shell.spec.ts`.
 *
 * The overlay-scrim half of this invariant lives in `a11y-shell.spec.ts`, which
 * already has a tenant and already opens overlays.
 *
 * NOT tagged `@local-only`: CI `grepInvert`s that tag, and a guard CI skips is not a
 * guard.
 */
test.describe("printable documents", () => {
  test("printable content survives print media", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    /**
     * Inject the probe rather than hunting for a real element.
     *
     * Picking an existing `.shadow-sm` element was the first attempt and it was
     * unreliable in a subtle way: plenty of real content legitimately carries
     * `print:hidden`, so the test failed on an element that was *supposed* to be
     * hidden. A probe appended directly to `<body>` has no such ancestor and no
     * print-opt-out, so `display: none` on it can only come from the blanket rule
     * this is guarding. The control probe below proves the print rules really are
     * being applied, so a pass cannot be vacuous.
     */
    await page.evaluate(() => {
      const make = (classes: string, id: string) => {
        const el = document.createElement("div");
        el.id = id;
        el.className = classes;
        el.textContent = id;
        document.body.appendChild(el);
        return el;
      };
      make("shadow-sm p-2", "print-probe-shadow-sm");
      make("shadow-xl p-2", "print-probe-shadow-xl");
      // Control: this one MUST be hidden for print, proving print media applied.
      make("print:hidden p-2", "print-probe-control");
    });

    const displayOf = (id: string) =>
      page.evaluate((elementId) => {
        const el = document.getElementById(elementId);
        if (!el) return "missing";
        return getComputedStyle(el).display;
      }, id);

    // --- on screen ------------------------------------------------------------
    expect(await displayOf("print-probe-shadow-sm")).not.toBe("none");
    expect(await displayOf("print-probe-shadow-xl")).not.toBe("none");
    expect(await displayOf("print-probe-control")).not.toBe("none");

    // --- print media ----------------------------------------------------------
    await page.emulateMedia({ media: "print" });

    // Control first: if print rules did not apply, everything below is meaningless.
    expect(
      await displayOf("print-probe-control"),
      "print media is not being applied — a print:hidden probe is still displayed, so this test would pass vacuously",
    ).toBe("none");

    expect(
      await displayOf("print-probe-shadow-sm"),
      ".shadow-sm is hidden under print media — a blanket print rule is hiding printable content again, which is the blank-ID-card bug",
    ).not.toBe("none");

    expect(
      await displayOf("print-probe-shadow-xl"),
      ".shadow-xl is hidden under print media — a blanket print rule is hiding printable content again",
    ).not.toBe("none");

    await page.emulateMedia({ media: "screen" });
  });
});
