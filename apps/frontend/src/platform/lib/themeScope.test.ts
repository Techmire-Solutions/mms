import { describe, expect, it } from "vitest";
import { shouldForcePlatformEnglish } from "@/platform/lib/themeScope";

describe("shouldForcePlatformEnglish", () => {
  it("forces English on the entire platform apex host", () => {
    expect(
      shouldForcePlatformEnglish({
        isApex: true,
        workspaceLoading: false,
        workspace: null,
      }),
    ).toBe(true);
  });

  it("forces English on missing or disabled tenant hosts", () => {
    expect(
      shouldForcePlatformEnglish({
        isApex: false,
        workspaceLoading: false,
        workspace: null,
      }),
    ).toBe(true);
    expect(
      shouldForcePlatformEnglish({
        isApex: false,
        workspaceLoading: false,
        workspace: { enabled: false },
      }),
    ).toBe(true);
  });

  it("forces English when workspace lookup fails for a non-404 reason", () => {
    expect(
      shouldForcePlatformEnglish({
        isApex: false,
        workspaceLoading: false,
        workspace: null,
        workspaceLookupFailed: true,
      }),
    ).toBe(true);
  });

  it("does not force English while tenant workspace is loading or enabled", () => {
    expect(
      shouldForcePlatformEnglish({
        isApex: false,
        workspaceLoading: true,
        workspace: null,
      }),
    ).toBe(false);
    expect(
      shouldForcePlatformEnglish({
        isApex: false,
        workspaceLoading: false,
        workspace: { enabled: true },
      }),
    ).toBe(false);
  });
});
