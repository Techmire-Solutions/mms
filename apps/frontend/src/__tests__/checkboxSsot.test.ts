import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Checkbox SSOT ratchet — the product has exactly one checkbox implementation
 * (`@shared/ui` Checkbox / CheckboxField / FormCheckboxCard). This guards the
 * two regressions that caused the 2026-11-01 “checkboxes don't work” report and
 * keeps bespoke checkbox markup from returning:
 *
 *  1. raw `<input type="checkbox">` (unstyled, no 44px target, no primitive fixes);
 *  2. a hand-rolled `role="checkbox"` control (use the primitive, or `aria-pressed`
 *     for a toggle *button* — a multi-select chip is not a checkbox).
 *
 * Selector strings such as `closest('button[role="checkbox"]')` are allowed: they
 * query the primitive, they do not implement one.
 */
const SOURCE_ROOT = path.resolve(import.meta.dirname, "..");
const SKIP_DIRS = new Set(["node_modules", "dist", "__tests__", "test"]);

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return SKIP_DIRS.has(entry.name) ? [] : walk(fullPath);
    }
    if (!/\.tsx?$/.test(entry.name) || /\.test\.tsx?$/.test(entry.name)) return [];
    return [fullPath];
  });
}

describe("checkbox SSOT", () => {
  const files = walk(SOURCE_ROOT);

  it("has no raw native checkbox inputs", () => {
    const offenders = files.filter((file) =>
      /<input\b[^>]*\btype=["']checkbox/.test(readFileSync(file, "utf8")),
    );
    expect(offenders.map((file) => path.relative(SOURCE_ROOT, file))).toEqual([]);
  });

  it("has no hand-rolled role=checkbox controls", () => {
    const offenders = files.filter((file) =>
      // Attribute form only (newline + indentation or inline after other props);
      // selector strings contain `[role="checkbox"]` and do not match this.
      /\srole="checkbox"/.test(readFileSync(file, "utf8")),
    );
    expect(offenders.map((file) => path.relative(SOURCE_ROOT, file))).toEqual([]);
  });
});
