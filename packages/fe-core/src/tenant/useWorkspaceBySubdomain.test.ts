import { describe, expect, it, vi, beforeEach } from "vitest";
import { ApiError } from "../api/client";
import { fetchWorkspaceBySubdomain, isWorkspaceNotFoundError } from "./useWorkspaceBySubdomain";

const apiFetchMock = vi.hoisted(() => vi.fn());

vi.mock("../api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/client")>();
  return {
    ...actual,
    apiFetch: apiFetchMock,
    resolveApiUrl: (path: string) => path,
  };
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

describe("fetchWorkspaceBySubdomain", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it("forwards the abort signal to the workspace endpoint", async () => {
    apiFetchMock.mockResolvedValue({
      status: 200,
      json: async () => ({ workspace: { subdomain: "demo", madrasaName: "Demo" }, branding: null }),
    });
    const controller = new AbortController();

    const res = await fetchWorkspaceBySubdomain("demo", controller.signal);

    expect(apiFetchMock).toHaveBeenCalledWith("/api/workspace/by-subdomain/demo", {
      method: "GET",
      signal: controller.signal,
    });
    expect(res).toEqual({
      status: 200,
      body: { workspace: { subdomain: "demo", madrasaName: "Demo" }, branding: null },
    });
  });

  it("maps a 404 into a body-null result instead of throwing", async () => {
    apiFetchMock.mockResolvedValue({ status: 404, json: async () => null });

    await expect(fetchWorkspaceBySubdomain("missing")).resolves.toEqual({
      status: 404,
      body: null,
    });
  });

  it("rejects unexpected statuses with a status-carrying error", async () => {
    apiFetchMock.mockResolvedValue({ status: 500, json: async () => null });

    await expect(fetchWorkspaceBySubdomain("demo")).rejects.toMatchObject({ status: 500 });
  });
});
