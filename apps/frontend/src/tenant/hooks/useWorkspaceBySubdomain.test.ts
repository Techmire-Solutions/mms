import { beforeEach, describe, expect, it, vi } from "vitest";

const { bySubdomain } = vi.hoisted(() => ({ bySubdomain: vi.fn() }));

vi.mock("@/lib/api", () => ({ apiContract: { workspace: { bySubdomain } } }));

import { fetchWorkspaceBySubdomain } from "./useWorkspaceBySubdomain";

const ok = (body: unknown) => ({ status: 200, body, headers: new Headers() });

describe("fetchWorkspaceBySubdomain", () => {
  beforeEach(() => {
    bySubdomain.mockReset();
  });

  it("looks the workspace up by its subdomain path parameter", async () => {
    const mockResult = {
      workspace: { subdomain: "alpha", madrasaName: "Alpha Madrasa" },
      branding: null,
    };
    bySubdomain.mockResolvedValue(ok(mockResult));

    const result = await fetchWorkspaceBySubdomain("alpha");

    expect(bySubdomain).toHaveBeenCalledWith(
      expect.objectContaining({ params: { subdomain: "alpha" } }),
    );
    expect(result).toEqual({ status: 200, body: mockResult });
  });

  it("passes the raw subdomain — the contract client encodes the path", async () => {
    bySubdomain.mockResolvedValue(
      ok({ workspace: { subdomain: "test space", madrasaName: "Test" }, branding: null }),
    );

    await fetchWorkspaceBySubdomain("test space");

    expect(bySubdomain).toHaveBeenCalledWith(
      expect.objectContaining({ params: { subdomain: "test space" } }),
    );
  });

  it("returns 404 with null body when the workspace is not found", async () => {
    bySubdomain.mockResolvedValue({ status: 404, body: null, headers: new Headers() });

    const result = await fetchWorkspaceBySubdomain("nonexistent");

    expect(result).toEqual({ status: 404, body: null });
  });

  it("throws a status-tagged error when the server responds with 500", async () => {
    bySubdomain.mockResolvedValue({ status: 500, body: {}, headers: new Headers() });

    await expect(fetchWorkspaceBySubdomain("error-subdomain")).rejects.toThrow(
      "Workspace lookup failed: 500",
    );
  });
});
