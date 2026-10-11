import { describe, expect, it } from "vitest";
import {
  DEFAULT_BRANDING_CORNER_STYLE,
  normalizeBrandingCornerStyle,
  resolveBrandingCornerRadius,
} from "./brandingCornerStyle.js";

describe("brandingCornerStyle", () => {
  it("normalizes unknown values to rounded default", () => {
    expect(normalizeBrandingCornerStyle(undefined)).toBe(DEFAULT_BRANDING_CORNER_STYLE);
    expect(normalizeBrandingCornerStyle("invalid")).toBe("rounded");
    expect(normalizeBrandingCornerStyle("sharp")).toBe("sharp");
    expect(normalizeBrandingCornerStyle("12px")).toBe("12px");
    expect(normalizeBrandingCornerStyle("0.5rem")).toBe("0.5rem");
  });

  it("maps each style to a CSS radius token", () => {
    expect(resolveBrandingCornerRadius("sharp")).toBe("0.125rem");
    expect(resolveBrandingCornerRadius("rounded")).toBe("0.625rem");
    expect(resolveBrandingCornerRadius("soft")).toBe("1rem");
    expect(resolveBrandingCornerRadius("16px")).toBe("16px");
    expect(resolveBrandingCornerRadius("8")).toBe("8px");
  });
});
