import { describe, expect, it, vi } from "vitest";
import { SYSTEM_MODULES } from "@mms/shared";

const mockSelect = vi.fn();
vi.mock("../db/dbConnection.js", () => ({
  activeDb: () => ({
    select: mockSelect,
  }),
}));

import { getWorkspaceGrantedModulesRepo } from "../db/repositories/workspaceRepository.js";

describe("getWorkspaceGrantedModulesRepo", () => {
  it("returns all system modules when grantedModules is null or empty", async () => {
    mockSelect.mockReturnValue({
      from: () => ({
        where: () => [{ grantedModules: null }],
      }),
    });

    const result = await getWorkspaceGrantedModulesRepo("test-sub");
    expect(result).toEqual(SYSTEM_MODULES.map((m) => m.id));
  });

  it("includes newly introduced modules when not explicitly disabled in grantedModules", async () => {
    // Existing workspace saved before obligations existed
    const legacyGranted = {
      dashboard: true,
      contacts: true,
      hasanat: false, // explicitly revoked
    };

    mockSelect.mockReturnValue({
      from: () => ({
        where: () => [{ grantedModules: legacyGranted }],
      }),
    });

    const result = await getWorkspaceGrantedModulesRepo("test-sub");

    // Explicitly enabled modules must be included
    expect(result).toContain("dashboard");
    expect(result).toContain("contacts");

    // Explicitly revoked module must NOT be included
    expect(result).not.toContain("hasanat");

    // New modules (like obligations) must be included since they were never revoked
    expect(result).toContain("obligations");
  });
});
