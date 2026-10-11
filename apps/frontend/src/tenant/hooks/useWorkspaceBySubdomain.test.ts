import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiFetch, resolveApiUrl } = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  resolveApiUrl: vi.fn((path: string) => `http://127.0.0.1:3000${path}`),
}));

vi.mock("@/lib/apiClient", () => ({
  apiFetch,
  resolveApiUrl,
}));

import { fetchWorkspaceBySubdomain } from "./useWorkspaceBySubdomain";

describe("fetchWorkspaceBySubdomain", () => {
  beforeEach(() => {
    apiFetch.mockReset();
    resolveApiUrl.mockClear();
  });

  it("requests /api/workspace/by-subdomain/:subdomain with path parameter", async () => {
    const mockResult = {
      workspace: { subdomain: "alpha", madrasaName: "Alpha Madrasa" },
      branding: null,
    };
    apiFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResult,
    });

    const result = await fetchWorkspaceBySubdomain("alpha");

    expect(resolveApiUrl).toHaveBeenCalledWith("/api/workspace/by-subdomain/alpha");
    expect(result).toEqual({ status: 200, body: mockResult });
  });

  it("encodes special characters in subdomain path parameter", async () => {
    apiFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        workspace: { subdomain: "test space", madrasaName: "Test" },
        branding: null,
      }),
    });

    await fetchWorkspaceBySubdomain("test space");

    expect(resolveApiUrl).toHaveBeenCalledWith("/api/workspace/by-subdomain/test%20space");
  });

  it("returns 404 with null body when workspace is not found", async () => {
    apiFetch.mockResolvedValue({
      ok: false,
      status: 404,
    });

    const result = await fetchWorkspaceBySubdomain("nonexistent");

    expect(result).toEqual({ status: 404, body: null });
  });

  it("throws error when server responds with 500", async () => {
    apiFetch.mockResolvedValue({
      ok: false,
      status: 500,
    });

    await expect(fetchWorkspaceBySubdomain("error-subdomain")).rejects.toThrow(
      "Workspace lookup failed: 500",
    );
  });
});
