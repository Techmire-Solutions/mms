import { describe, it, expect } from "vitest";
import { cn, isImeSafeEnter } from "./utils";

describe("packages/ui utils", () => {
  describe("cn", () => {
    it("merges classes correctly", () => {
      expect(cn("px-2 py-1", "bg-primary")).toContain("bg-primary");
    });
  });

  describe("isImeSafeEnter", () => {
    it("returns false for non-Enter keys", () => {
      expect(isImeSafeEnter({ key: "Escape" })).toBe(false);
      expect(isImeSafeEnter({ key: "Tab" })).toBe(false);
      expect(isImeSafeEnter({ key: "a" })).toBe(false);
    });

    it("returns true for standard Enter key when not composing", () => {
      expect(isImeSafeEnter({ key: "Enter" })).toBe(true);
      expect(
        isImeSafeEnter({
          key: "Enter",
          nativeEvent: { isComposing: false, keyCode: 13 },
        }),
      ).toBe(true);
    });

    it("returns false when native isComposing is true (IME text composition)", () => {
      expect(
        isImeSafeEnter({
          key: "Enter",
          nativeEvent: { isComposing: true, keyCode: 13 },
        }),
      ).toBe(false);
    });

    it("returns false when keyCode is 229 (Safari / mobile IME composition fallback)", () => {
      expect(
        isImeSafeEnter({
          key: "Enter",
          nativeEvent: { isComposing: false, keyCode: 229 },
        }),
      ).toBe(false);
    });
  });
});
