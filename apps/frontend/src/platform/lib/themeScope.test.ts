import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/apiClient";
import { shouldForcePlatformEnglish } from "@/platform/lib/themeScope";
import { isWorkspaceNotFoundError } from "@/tenant/hooks/useWorkspaceBySubdomain";

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

describe("isWorkspaceNotFoundError", () => {
  it("treats 404 / not_found as missing tenant", () => {
    expect(isWorkspaceNotFoundError(new ApiError(404, "Workspace not found", "not_found"))).toBe(
      true,
    );
    expect(isWorkspaceNotFoundError(new ApiError(404, "missing"))).toBe(true);
  });

  it("does not treat network or server failures as missing tenant", () => {
    expect(isWorkspaceNotFoundError(new ApiError(500, "boom", "server_error"))).toBe(false);
    expect(isWorkspaceNotFoundError(new ApiError(503, "unavailable", "request_failed"))).toBe(
      false,
    );
    expect(isWorkspaceNotFoundError(new Error("Failed to fetch"))).toBe(false);
    expect(isWorkspaceNotFoundError(undefined)).toBe(false);
  });
});
