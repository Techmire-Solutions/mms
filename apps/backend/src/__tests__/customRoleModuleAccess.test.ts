import { describe, expect, it, vi } from "vitest";
import type { FastifyRequest } from "fastify";

const mockAvailability = vi.fn();
const mockMatrix = vi.fn();

vi.mock("../lib/moduleAvailabilityService.js", () => ({
  loadModuleAvailability: (...args: unknown[]) => mockAvailability(...args),
}));

vi.mock("../services/rbacService.js", () => ({
  getTenantRoleMatrix: (...args: unknown[]) => mockMatrix(...args),
}));

vi.mock("../lib/tenantContext.js", () => ({
  getRequestTenant: () => "demo",
}));

import { checkModuleAccess } from "../middleware/requireTenantModule.js";

function request(): FastifyRequest {
  return {
    tenant: { id: "demo" },
    user: { id: "u-1", role: "faculty_ed_c1", workspaceSubdomain: "demo" },
  } as unknown as FastifyRequest;
}

describe("module access with a tenant custom role (S1)", () => {
  it.fails("grants a composite role the permissions its workspace catalog defines", async () => {
    // KNOWN GAP: `checkModuleAccess` calls `roleHasPermission(role, permission)`
    // without the workspace's `workspaceRoles`, so a designation-managed
    // composite role (`faculty_ed_*`) can never match the default role map and
    // every module route answers 403 PERMISSION_DENIED. This test is marked
    // `fails` so it starts failing (and demands removal) when the gate is fixed.
    mockAvailability.mockResolvedValue({
      students: { granted: true, enabled: true },
    });
    mockMatrix.mockResolvedValue({
      "u-1": { role: "faculty_ed_c1", deletedAt: null },
    });

    const decision = await checkModuleAccess(request(), "students", "read");

    expect(decision.allowed).toBe(true);
  });
});
