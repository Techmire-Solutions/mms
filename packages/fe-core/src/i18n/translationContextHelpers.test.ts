import { afterEach, describe, expect, it, vi } from "vitest";
import { APP_TRANSLATIONS_EN, registerLanguagePack } from "@mms/contracts";
import {
  fetchLanguagePack,
  resolveUiLanguage,
  type ResolveUiLanguageOptions,
} from "./translationContextHelpers.js";

// The language packs are large static exports; only the registration side effect is asserted.
vi.mock("@mms/contracts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@mms/contracts")>();
  return { ...actual, registerLanguagePack: vi.fn() };
});

const tenantContent: ResolveUiLanguageOptions = {
  isApex: false,
  workspaceLoading: false,
  workspace: { enabled: true },
  workspaceLookupFailed: false,
  pathname: "/students",
  settingsLanguage: "ar",
};

afterEach(() => {
  vi.clearAllMocks();
});

describe("resolveUiLanguage", () => {
  it("forces English on the platform apex", () => {
    expect(resolveUiLanguage({ ...tenantContent, isApex: true })).toBe("en");
  });

  it("forces English when the workspace lookup failed", () => {
    expect(resolveUiLanguage({ ...tenantContent, workspaceLookupFailed: true })).toBe("en");
  });

  it("forces English when the workspace is disabled or missing", () => {
    expect(resolveUiLanguage({ ...tenantContent, workspace: { enabled: false } })).toBe("en");
    expect(resolveUiLanguage({ ...tenantContent, workspace: null })).toBe("en");
  });

  it("keeps the stored tenant language while the workspace is still loading", () => {
    expect(resolveUiLanguage({ ...tenantContent, workspace: null, workspaceLoading: true })).toBe(
      "ar",
    );
  });

  it("forces English on tenant auth entry paths", () => {
    expect(resolveUiLanguage({ ...tenantContent, pathname: "/login" })).toBe("en");
    expect(resolveUiLanguage({ ...tenantContent, pathname: "/forgot-password" })).toBe("en");
  });

  it("uses the stored tenant language on tenant content", () => {
    expect(resolveUiLanguage(tenantContent)).toBe("ar");
    expect(resolveUiLanguage({ ...tenantContent, settingsLanguage: "ur" })).toBe("ur");
  });
});

describe("fetchLanguagePack", () => {
  it.each(["ar", "ur", "fa"])("registers the %s language pack", async (language) => {
    await fetchLanguagePack(language);
    expect(registerLanguagePack).toHaveBeenCalledWith(language, expect.any(Object));
  });

  it("leaves English on its built-in pack", async () => {
    await fetchLanguagePack("en");
    expect(registerLanguagePack).not.toHaveBeenCalled();
  });
});

describe("English pack availability", () => {
  it("ships a non-empty pack for the runtime key guard", () => {
    expect(Object.keys(APP_TRANSLATIONS_EN).length).toBeGreaterThan(0);
  });
});
