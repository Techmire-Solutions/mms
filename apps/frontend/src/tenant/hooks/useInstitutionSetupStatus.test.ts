import { beforeEach, describe, expect, it, vi } from "vitest";

const { institutionSetupStatus } = vi.hoisted(() => ({
  institutionSetupStatus: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  apiContract: {
    auth: { institutionSetupStatus },
  },
}));

import { fetchInstitutionSetupStatus } from "./useInstitutionSetupStatus";

describe("fetchInstitutionSetupStatus", () => {
  beforeEach(() => {
    institutionSetupStatus.mockReset();
  });

  it("reads the workspace-wide setup status through the shared auth contract", async () => {
    const controller = new AbortController();
    institutionSetupStatus.mockResolvedValue({
      status: 200,
      body: { complete: true },
    });

    await expect(fetchInstitutionSetupStatus(controller.signal)).resolves.toBe(true);
    expect(institutionSetupStatus).toHaveBeenCalledWith({
      fetchOptions: { signal: controller.signal },
    });
  });

  it("rejects non-success responses instead of treating them as incomplete setup", async () => {
    institutionSetupStatus.mockResolvedValue({
      status: 500,
      body: { type: "database_error", message: "Failed to load setup status" },
    });

    await expect(fetchInstitutionSetupStatus()).rejects.toMatchObject({
      status: 500,
      type: "database_error",
    });
  });
});
