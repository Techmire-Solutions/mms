import { beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeWorkspaceRoles, type User } from "@mms/contracts";
import { canWriteUserPreferences } from "../routes/tenant/users/userSetupConfigAuthorization.js";

vi.mock("../lib/userPermissionContext.js", () => ({
  userHasPermission: vi.fn(),
}));
vi.mock("../services/userPreferencesService.js", () => ({
  loadUserModulePreferences: vi.fn(),
}));

import { userHasPermission } from "../lib/userPermissionContext.js";
import { loadUserModulePreferences } from "../services/userPreferencesService.js";

const hasPermission = vi.mocked(userHasPermission);
const loadPreferences = vi.mocked(loadUserModulePreferences);

const actor = (role: string): User => ({ role }) as User;

describe("canWriteUserPreferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("denies when the actor lacks settings.global.write", async () => {
    hasPermission.mockReturnValue(false);
    await expect(canWriteUserPreferences(actor("settings_manager"), {})).resolves.toBe(false);
  });

  it("allows a save that does not touch workspaceRoles", async () => {
    hasPermission.mockReturnValue(true);
    await expect(
      canWriteUserPreferences(actor("settings_manager"), { allowSelfRegistration: true }),
    ).resolves.toBe(true);
    expect(loadPreferences).not.toHaveBeenCalled();
  });

  it("allows admin/super_admin to change workspaceRoles", async () => {
    hasPermission.mockReturnValue(true);
    await expect(
      canWriteUserPreferences(actor("admin"), { workspaceRoles: [{ id: "x" }] }),
    ).resolves.toBe(true);
    expect(loadPreferences).not.toHaveBeenCalled();
  });

  it("denies a non-admin whose workspaceRoles differ from the persisted catalog", async () => {
    hasPermission.mockReturnValue(true);
    const current =
      normalizeWorkspaceRoles([
        { id: "admin", name: "Admin", permissions: { users: ["read"] } },
        { id: "teacher", name: "Teacher", permissions: { users: ["read"] } },
      ]) ?? [];
    loadPreferences.mockResolvedValue({ workspaceRoles: current } as never);

    await expect(
      canWriteUserPreferences(actor("settings_manager"), {
        workspaceRoles: [
          { id: "settings_manager", name: "Settings Manager", permissions: { users: ["manage"] } },
        ],
      }),
    ).resolves.toBe(false);
  });

  it("allows a non-admin whose workspaceRoles are unchanged", async () => {
    hasPermission.mockReturnValue(true);
    const current =
      normalizeWorkspaceRoles([
        { id: "admin", name: "Admin", permissions: { users: ["read"] } },
        { id: "teacher", name: "Teacher", permissions: { users: ["read"] } },
      ]) ?? [];
    loadPreferences.mockResolvedValue({ workspaceRoles: current } as never);

    await expect(
      canWriteUserPreferences(actor("settings_manager"), { workspaceRoles: current }),
    ).resolves.toBe(true);
  });
});
