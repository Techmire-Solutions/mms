import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Guards the `@media print` contract in `src/index.css`.
 *
 * The block used to hide `.shadow-sm`, `.shadow-xl`, `.border-b.border-border` and
 * `[role="group"]` outright. The first two are *content* classes, not chrome:
 * `.id-card-preview` (student/teacher ID cards) is `shadow-sm`, so every printed ID
 * card was `display:none` and the page came out blank — while
 * `print-color-adjust: exact` forced the full-viewport overlay scrim to print as a
 * solid dark page. `[role="group"]` is how Radix marks checkbox/radio/select groups,
 * i.e. more legitimate content.
 *
 * jsdom cannot evaluate `@media print`, so the cascade is asserted here by reading
 * the source, and end-to-end by `e2e/tests/print-documents.spec.ts` using
 * `page.emulateMedia({ media: 'print' })`. This test is the cheap one that runs on
 * every unit-test invocation.
 */

const INDEX_CSS = path.resolve(import.meta.dirname, "../index.css");

/** The declaration block of the `@media print { … }` rule. */
function printBlock(css: string): string {
  const start = css.indexOf("@media print");
  if (start === -1) throw new Error("no @media print block in index.css");
  const open = css.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === "{") depth += 1;
    else if (css[i] === "}") {
      depth -= 1;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }
  throw new Error("unterminated @media print block");
}

/**
 * Selectors the print block hides.
 *
 * Selectors appear two ways: as members of a comma-separated list (one per line,
 * trailing comma) and as the head of their own nested rule (`sel {`). Normalise
 * both down to a bare selector.
 */
function hiddenSelectors(block: string): string[] {
  return block
    .split("\n")
    .map((line) => line.trim())
    .map((line) => line.replace(/\{$/, "").trim()) // `sel {` -> `sel`
    .map((line) => line.replace(/,$/, "").trim()) // `sel,` -> `sel`
    .filter((line) => line.length > 0 && !line.startsWith("/*") && !line.includes(":"));
}

const css = readFileSync(INDEX_CSS, "utf-8");
const block = printBlock(css);
const selectors = hiddenSelectors(block);

describe("print stylesheet", () => {
  /**
   * These are the classes that made printed documents vanish. Each is a legitimate
   * content style; hiding it by element-agnostic class is always wrong.
   */
  it.each([".shadow-sm", ".shadow-xl", ".shadow-lg", '[role="group"]', ".border-b.border-border"])(
    "does not blanket-hide %s",
    (selector) => {
      expect(
        selectors,
        `${selector} is hidden for print. These are content classes — hiding them deletes printable content (this is the blank ID-card bug). Opt out with .print-hidden / print:hidden / [data-print-hide] instead.`,
      ).not.toContain(selector);
    },
  );

  it("hides app chrome", () => {
    for (const selector of ["aside", "header", "nav", ".print-hidden"]) {
      expect(selectors).toContain(selector);
    }
  });

  it("hides the overlay backdrop, which portals outside the app tree", () => {
    // Overlays render into <body> via a portal, so none of the element selectors
    // above reach them. Without this, the scrim prints as a solid dark page.
    expect(selectors).toContain("[data-overlay-backdrop]");
    expect(selectors).toContain("[data-print-hide]");
  });

  it("unclamps print containers", () => {
    // Modal panels are `fixed` + viewport-clamped for screen; left alone they clip
    // a multi-page document to one scroll viewport.
    expect(block).toMatch(/\[data-print-unclamp\][^}]*position:\s*static/);
    expect(block).toMatch(/\[data-print-unclamp\][^}]*overflow:\s*visible/);
    expect(block).toMatch(/\[data-print-unclamp\][^}]*max-height:\s*none/);
  });

  it("still forces background colours on", () => {
    // Documents rely on this (branded headers, receipt tints). It is also why the
    // backdrop had to be explicitly hidden rather than left to the browser.
    expect(block).toMatch(/print-color-adjust:\s*exact/);
  });
});
