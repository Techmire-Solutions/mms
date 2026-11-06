import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Button primitives may only style through semantic tokens. This is the
 * zero-baseline guard behind the 2026-11-06 audit: bespoke hex/RGB/HSL values,
 * arbitrary Tailwind colours, inline colour styles and a second radius scale all
 * fail here before they can spread across the 850 `<Button>` call sites.
 */
const REPO_ROOT = path.resolve(import.meta.dirname, "../../../..");
const BUTTON_PRIMITIVES = [
  "packages/ui/src/button/Button.tsx",
  "packages/ui/src/button/CopyButton.tsx",
] as const;

const ARBITRARY_COLOUR = /\[#[0-9a-fA-F]|\[rgba?\(|\[hsla?\(/;
const HEX_COLOUR = /#[0-9a-fA-F]{3,8}\b/;
const INLINE_COLOUR_STYLE = /style=\{\{[^}]*(?:color|background|borderColor)/;

describe.each(BUTTON_PRIMITIVES)("button primitive — %s", (relativePath) => {
  const source = readFileSync(path.join(REPO_ROOT, relativePath), "utf-8");

  it("uses semantic tokens instead of hardcoded colours", () => {
    expect(source, "arbitrary Tailwind colour").not.toMatch(ARBITRARY_COLOUR);
    expect(source, "hardcoded hex colour").not.toMatch(HEX_COLOUR);
    expect(source, "inline colour style").not.toMatch(INLINE_COLOUR_STYLE);
  });

  it("keeps the single radius scale", () => {
    expect(source).not.toContain("rounded-xl");
    expect(source).not.toContain("rounded-2xl");
  });
});

describe("button primitives — shared component ownership", () => {
  it("keeps the frontend facade a pure re-export", () => {
    const facade = readFileSync(
      path.join(REPO_ROOT, "apps/frontend/src/components/ui/button.tsx"),
      "utf-8",
    );
    expect(facade.trim()).toBe(
      'export { Button, buttonVariants, type ButtonProps } from "@shared/ui";',
    );
  });

  it("removes CopyButton's bespoke colour/shadow/radius block", () => {
    const copyButton = readFileSync(
      path.join(REPO_ROOT, "packages/ui/src/button/CopyButton.tsx"),
      "utf-8",
    );
    expect(copyButton).not.toContain("DEFAULT_ICON_BTN_CLASS");
    expect(copyButton).not.toMatch(/variant=\{variant\}/);
    expect(copyButton).toContain('variant={variant ?? "outline"}');
    expect(copyButton).toContain('size="icon"');
  });
});
