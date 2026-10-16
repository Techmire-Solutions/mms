import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/apiClient";
import { isWorkspaceNotFoundError } from "./useWorkspaceBySubdomain";

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
