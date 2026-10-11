import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyRequest } from "fastify";

vi.mock("../lib/currentTenantRole.js", () => ({
  resolveCurrentTenantRole: vi.fn(),
}));

vi.mock("../services/users/usersSettingsService.js", () => ({
  getTenantUsersSettings: vi.fn(),
}));

vi.mock("@mms/shared", async () => {
  const actual = await vi.importActual<typeof import("@mms/shared")>("@mms/shared");
  return {
    ...actual,
    roleHasPermission: vi.fn(),
  };
});

import { roleHasPermission } from "@mms/shared";
import { resolveCurrentTenantRole } from "../lib/currentTenantRole.js";
import { getTenantUsersSettings } from "../services/users/usersSettingsService.js";
import { canPerformTaskAction } from "../services/taskPermissionService.js";

describe("canPerformTaskAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("denies assign_anywhere when role lacks the permission", async () => {
    vi.mocked(resolveCurrentTenantRole).mockResolvedValue("teacher");
    vi.mocked(getTenantUsersSettings).mockResolvedValue({ workspaceRoles: {} } as never);
    vi.mocked(roleHasPermission).mockReturnValue(false);

    const request = {
      user: { id: "u1", role: "teacher" },
      tenant: { id: "demo" },
    } as unknown as FastifyRequest;

    await expect(canPerformTaskAction(request, "tasks.assign_anywhere")).resolves.toBe(false);
    expect(roleHasPermission).toHaveBeenCalledWith("teacher", "tasks.assign_anywhere", {});
  });

  it("allows tasks.assign when roleHasPermission returns true", async () => {
    vi.mocked(resolveCurrentTenantRole).mockResolvedValue("admin");
    vi.mocked(getTenantUsersSettings).mockResolvedValue({ workspaceRoles: {} } as never);
    vi.mocked(roleHasPermission).mockReturnValue(true);

    const request = {
      user: { id: "u1", role: "admin" },
      tenant: { id: "demo" },
    } as unknown as FastifyRequest;

    await expect(canPerformTaskAction(request, "tasks.assign")).resolves.toBe(true);
  });

  it("denies when tenant or user is missing", async () => {
    const request = {
      user: undefined,
      tenant: undefined,
    } as unknown as FastifyRequest;

    await expect(canPerformTaskAction(request, "tasks.assign")).resolves.toBe(false);
  });
});
