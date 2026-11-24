import { afterEach, describe, expect, it, vi } from "vitest";
import { applyDocumentLanguage } from "./documentLanguage.js";

const resetDocumentLanguage = (): void => {
  document.documentElement.removeAttribute("lang");
  document.documentElement.removeAttribute("dir");
  document.documentElement.style.removeProperty("--font-sans");
  document.documentElement.style.removeProperty("--font-display");
};

afterEach(() => {
  vi.unstubAllGlobals();
  resetDocumentLanguage();
});

describe("applyDocumentLanguage", () => {
  it.each([
    ["en", "ltr"],
    ["ar", "rtl"],
    ["ur", "rtl"],
    ["fa", "rtl"],
  ])("applies lang, dir and font stacks for %s", (language, direction) => {
    applyDocumentLanguage(language);

    expect(document.documentElement.getAttribute("lang")).toBe(language);
    expect(document.documentElement.getAttribute("dir")).toBe(direction);
    expect(document.documentElement.style.getPropertyValue("--font-sans")).not.toBe("");
    expect(document.documentElement.style.getPropertyValue("--font-display")).not.toBe("");
  });

  it("normalizes an unsupported code back to English/LTR", () => {
    applyDocumentLanguage("xx");

    expect(document.documentElement.getAttribute("lang")).toBe("en");
    expect(document.documentElement.getAttribute("dir")).toBe("ltr");
  });
});
