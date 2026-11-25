import { describe, expect, it, vi, beforeEach } from "vitest";
import { ApiError } from "../api/client";
import { fetchWorkspaceBySubdomain, isWorkspaceNotFoundError } from "./useWorkspaceBySubdomain";

const apiContractMock = vi.hoisted(() => ({
  workspace: { bySubdomain: vi.fn() },
}));

vi.mock("../api/tsRest", () => ({ apiContract: apiContractMock }));

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

describe("fetchWorkspaceBySubdomain", () => {
  beforeEach(() => {
    apiContractMock.workspace.bySubdomain.mockReset();
  });

  it("forwards the abort signal to the workspace contract", async () => {
    apiContractMock.workspace.bySubdomain.mockResolvedValue({
      status: 200,
      body: { workspace: { subdomain: "demo", madrasaName: "Demo" }, branding: null },
    });
    const controller = new AbortController();

    await fetchWorkspaceBySubdomain("demo", controller.signal);

    expect(apiContractMock.workspace.bySubdomain).toHaveBeenCalledWith({
      params: { subdomain: "demo" },
      signal: controller.signal,
      fetchOptions: { signal: controller.signal },
    });
  });

  it("maps a 404 into a body-null result instead of throwing", async () => {
    apiContractMock.workspace.bySubdomain.mockResolvedValue({ status: 404, body: null });

    await expect(fetchWorkspaceBySubdomain("missing")).resolves.toEqual({
      status: 404,
      body: null,
    });
  });

  it("rejects unexpected statuses with a status-carrying error", async () => {
    apiContractMock.workspace.bySubdomain.mockResolvedValue({ status: 500, body: null });

    await expect(fetchWorkspaceBySubdomain("demo")).rejects.toMatchObject({ status: 500 });
  });
});
