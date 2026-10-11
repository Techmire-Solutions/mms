import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BRANDING_THEME_VARIABLES,
  buildBrandingCssVariables,
  DEFAULT_BRANDING_SETTINGS,
} from "@mms/shared";
import { applyDocumentTheme } from "./brandingThemeCore";
import { applyApexPlatformTheme } from "@/platform/lib/brandingEntryTheme";
import { MMS_PLATFORM_BRANDING, MMS_PLATFORM_GLOBAL_SETTINGS } from "@/platform/lib/themeScope";

vi.mock("@/lib/localeFonts", () => ({ ensureLocaleFontsLoaded: vi.fn() }));

afterEach(() => {
  document.documentElement.removeAttribute("style");
  document.documentElement.classList.remove("dark");
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.removeAttribute("lang");
  document.documentElement.removeAttribute("dir");
  document.querySelector('meta[name="theme-color"]')?.remove();
  vi.restoreAllMocks();
});

describe("explicit document theme ownership", () => {
  it("replaces every tenant token and locale when returning to the platform", () => {
    applyDocumentTheme(
      { ...DEFAULT_BRANDING_SETTINGS, primaryColor: "#006699", secondaryColor: "#663399" },
      "dark",
      "ur",
    );
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.dir).toBe("rtl");
    applyApexPlatformTheme();
    const mode = MMS_PLATFORM_GLOBAL_SETTINGS.theme === "dark" ? "dark" : "light";
    const expected = buildBrandingCssVariables(
      MMS_PLATFORM_BRANDING.primaryColor,
      MMS_PLATFORM_BRANDING.secondaryColor,
      mode,
    );
    for (const token of BRANDING_THEME_VARIABLES) {
      expect(document.documentElement.style.getPropertyValue(token)).toBe(expected[token]);
    }
    expect(document.documentElement.lang).toBe("en");
    expect(document.documentElement.dir).toBe("ltr");
    expect(document.documentElement.dataset.theme).toBe(mode);
    expect(document.documentElement.classList.contains("dark")).toBe(mode === "dark");
    expect(document.querySelectorAll('meta[name="theme-color"]')).toHaveLength(1);
  });

  it("resolves system mode at each application without retaining the previous mode", () => {
    const matchMedia = vi.spyOn(window, "matchMedia");
    matchMedia.mockReturnValue({
      ...window.matchMedia("(prefers-color-scheme: dark)"),
      matches: true,
    });
    applyDocumentTheme(DEFAULT_BRANDING_SETTINGS, "system", "en");
    expect(document.documentElement.dataset.theme).toBe("dark");
    matchMedia.mockReturnValue({
      ...window.matchMedia("(prefers-color-scheme: dark)"),
      matches: false,
    });
    applyDocumentTheme(DEFAULT_BRANDING_SETTINGS, "system", "en");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });
});
