import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/apiClient";

const { getSetupStatus } = vi.hoisted(() => ({
  getSetupStatus: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  apiContract: {
    platform: { getSetupStatus },
  },
}));

import { fetchPlatformSetupStatus } from "./usePlatformSetupStatus";

describe("fetchPlatformSetupStatus", () => {
  beforeEach(() => {
    getSetupStatus.mockReset();
  });

  it("uses the shared platform setup-status contract and forwards cancellation", async () => {
    const status = { needsSetup: false, smtpConfigured: true };
    const controller = new AbortController();
    getSetupStatus.mockResolvedValue({ status: 200, body: status });

    await expect(fetchPlatformSetupStatus(controller.signal)).resolves.toEqual(status);
    expect(getSetupStatus).toHaveBeenCalledWith({
      fetchOptions: { signal: controller.signal },
    });
  });

  it("rejects non-success responses so the query exposes its error state", async () => {
    getSetupStatus.mockResolvedValue({
      status: 404,
      body: { type: "not_found", message: "Not found" },
    });

    const result = fetchPlatformSetupStatus();
    await expect(result).rejects.toBeInstanceOf(ApiError);
    await expect(result).rejects.toMatchObject({ status: 404, type: "not_found" });
  });
});
