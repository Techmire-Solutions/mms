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

/**
 * Contacts archive/restore routes require `contacts.delete`, not `contacts.write`
 * (`MODULE_ROUTE_ACTION_RULES`). A tenant may compose a role with delete only, so
 * the gate must not demand write as a prerequisite.
 */
describe("contacts delete-only custom role", () => {
  const deleteOnlyRole: WorkspaceRole = {
    id: "contacts_archivist_c1",
    labelKey: "nav.contacts",
    descriptionKey: "nav.contacts",
    isSystem: false,
    badgeVariant: "primary",
    permissions: { contacts: ["delete"] },
  };

  function deleteOnlyRequest(): FastifyRequest {
    return {
      tenant: { id: "demo" },
      user: { id: "u-2", role: "contacts_archivist_c1", workspaceSubdomain: "demo" },
    } as unknown as FastifyRequest;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockAvailability.mockResolvedValue({
      contacts: { granted: true, enabled: true },
    });
    mockMatrix.mockResolvedValue({
      "u-2": { role: "contacts_archivist_c1", deletedAt: null },
    });
  });

  it("allows the delete action used by archive/restore routes", async () => {
    const req = deleteOnlyRequest();
    setUserRoleCatalog(req.user as User, [deleteOnlyRole]);

    const decision = await checkModuleAccess(req, "contacts", "delete");

    expect(decision).toMatchObject({ allowed: true });
  });

  it("denies write, so the route table must not fall back to the method default", async () => {
    const req = deleteOnlyRequest();
    setUserRoleCatalog(req.user as User, [deleteOnlyRole]);

    const decision = await checkModuleAccess(req, "contacts", "write");

    expect(decision).toMatchObject({ allowed: false, code: "PERMISSION_DENIED" });
  });

  it("denies the delete action to a write-only role", async () => {
    const writeOnlyRole: WorkspaceRole = {
      ...deleteOnlyRole,
      id: "contacts_editor_c1",
      permissions: { contacts: ["create", "read", "update"] },
    };
    mockMatrix.mockResolvedValue({
      "u-2": { role: "contacts_editor_c1", deletedAt: null },
    });
    const req = deleteOnlyRequest();
    (req.user as User).role = "contacts_editor_c1";
    setUserRoleCatalog(req.user as User, [writeOnlyRole]);

    const decision = await checkModuleAccess(req, "contacts", "delete");

    expect(decision).toMatchObject({ allowed: false, code: "PERMISSION_DENIED" });
  });
});
