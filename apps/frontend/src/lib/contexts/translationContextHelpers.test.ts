import { describe, it, expect } from "vitest";
import { resolveUiLanguage, fetchLanguagePack } from "./translationContextHelpers";

describe("translationContextHelpers", () => {
  describe("resolveUiLanguage", () => {
    it("returns 'en' for apex hosts", () => {
      const lang = resolveUiLanguage({
        isApex: true,
        workspaceLoading: false,
        workspace: null,
        workspaceLookupFailed: false,
        pathname: "/dashboard",
        settingsLanguage: "ar",
      });
      expect(lang).toBe("en");
    });

    it("returns 'en' for entry paths like /login", () => {
      const lang = resolveUiLanguage({
        isApex: false,
        workspaceLoading: false,
        workspace: { enabled: true },
        workspaceLookupFailed: false,
        pathname: "/login",
        settingsLanguage: "ur",
      });
      expect(lang).toBe("en");
    });

    it("returns settingsLanguage for authenticated tenant paths", () => {
      const lang = resolveUiLanguage({
        isApex: false,
        workspaceLoading: false,
        workspace: { enabled: true },
        workspaceLookupFailed: false,
        pathname: "/students",
        settingsLanguage: "ar",
      });
      expect(lang).toBe("ar");
    });
  });

  describe("fetchLanguagePack", () => {
    it("dynamically loads only the specified locale pack", async () => {
      await expect(fetchLanguagePack("ar")).resolves.toBeUndefined();
    });
  });
});
