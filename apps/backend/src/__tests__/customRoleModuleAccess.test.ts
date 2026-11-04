import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyRequest } from "fastify";
import type { User, WorkspaceRole } from "@mms/shared";

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
import { setUserRoleCatalog } from "../lib/userPermissionContext.js";

const compositeRole: WorkspaceRole = {
  id: "faculty_ed_c1",
  labelKey: "nav.tasks",
  descriptionKey: "nav.tasks",
  isSystem: false,
  badgeVariant: "primary",
  permissions: { students: ["read"] },
};

function request(): FastifyRequest {
  return {
    tenant: { id: "demo" },
    user: { id: "u-1", role: "faculty_ed_c1", workspaceSubdomain: "demo" },
  } as unknown as FastifyRequest;
}

describe("module access with a tenant custom role (S1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAvailability.mockResolvedValue({
      students: { granted: true, enabled: true },
      finance: { granted: true, enabled: true },
    });
    mockMatrix.mockResolvedValue({
      "u-1": { role: "faculty_ed_c1", deletedAt: null },
    });
  });

  it("grants a composite role the permissions its workspace catalog defines", async () => {
    const req = request();
    setUserRoleCatalog(req.user as User, [compositeRole]);

    const decision = await checkModuleAccess(req, "students", "read");

    expect(decision).toMatchObject({ allowed: true });
  });

  it("denies the same role when no catalog was attached", async () => {
    const decision = await checkModuleAccess(request(), "students", "read");

    expect(decision).toMatchObject({ allowed: false, code: "PERMISSION_DENIED" });
  });

  it("still denies a catalog role that lacks the module permission", async () => {
    const req = request();
    setUserRoleCatalog(req.user as User, [compositeRole]);

    const decision = await checkModuleAccess(req, "finance", "read");

    expect(decision).toMatchObject({ allowed: false, code: "PERMISSION_DENIED" });
  });
});
