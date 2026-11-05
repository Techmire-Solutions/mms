import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetPrefs = vi.fn();
const mockUpsertPrefs = vi.fn();
const mockBroadcast = vi.fn();
const mockInvalidateRbac = vi.fn();

vi.mock("../db/repositories/userModulePreferencesRepository.js", () => ({
  getUserModulePreferencesByWorkspace: (...args: unknown[]) => mockGetPrefs(...args),
  upsertUserModulePreferences: (...args: unknown[]) => mockUpsertPrefs(...args),
}));

vi.mock("../lib/tenantContext.js", () => ({
  requireTenant: () => "demo",
}));

vi.mock("../lib/livePush.js", () => ({
  broadcastCollection: (...args: unknown[]) => mockBroadcast(...args),
}));

vi.mock("../services/rbacService.js", () => ({
  invalidateTenantRbac: (...args: unknown[]) => mockInvalidateRbac(...args),
}));

import {
  loadUserModulePreferences,
  saveUserModulePreferences,
} from "../services/userPreferencesService.js";

describe("user module preferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPrefs.mockResolvedValue(null);
    mockUpsertPrefs.mockResolvedValue(undefined);
    mockBroadcast.mockResolvedValue(undefined);
    mockInvalidateRbac.mockResolvedValue(undefined);
  });

  it("returns null when the workspace has no stored preferences", async () => {
    await expect(loadUserModulePreferences()).resolves.toBeNull();
    expect(mockGetPrefs).toHaveBeenCalledWith("demo");
  });

  it("saves normalized preferences and invalidates the RBAC catalog", async () => {
    const saved = await saveUserModulePreferences({
      allowSelfRegistration: true,
      requireEmailVerification: false,
      defaultViewLayout: "grid",
      workspaceRoles: [],
    });

    expect(saved.defaultViewLayout).toBe("grid");
    expect(mockUpsertPrefs).toHaveBeenCalledWith("demo", expect.any(Object));
    expect(mockInvalidateRbac).toHaveBeenCalledWith("demo");
    expect(mockBroadcast).toHaveBeenCalledWith("users");
  });
});
