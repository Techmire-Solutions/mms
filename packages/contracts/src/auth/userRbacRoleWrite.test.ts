import { describe, expect, it } from "vitest";
import { workspaceRoleWriteSchema } from "./userRbacRoleWrite.js";
import type { WorkspaceRole } from "./userEntityTypes.js";
import { normalizePermissionMap, serializeWorkspaceRoleWrite } from "./userRbacRoleWrite.js";
import { normalizeWorkspaceRoles } from "./userSetupConfigTypes.js";

describe("workspaceRoleWriteSchema", () => {
  it("accepts a normal custom role and rejects blank names / unknown actions", () => {
    const valid = {
      id: "role_mentor",
      name: "Mentor",
      description: "Read-only mentor",
      permissions: { students: ["read", "create"] },
    };
    expect(workspaceRoleWriteSchema.safeParse(valid).success).toBe(true);
    expect(workspaceRoleWriteSchema.safeParse({ ...valid, name: "  " }).success).toBe(false);
    expect(
      workspaceRoleWriteSchema.safeParse({
        ...valid,
        permissions: { students: ["read", "launch_missiles"] },
      }).success,
    ).toBe(false);
  });
});

describe("normalizePermissionMap", () => {
  it("drops unknown modules/actions, dedupes, and orders actions", () => {
    expect(
      normalizePermissionMap({
        students: ["manage", "read", "read", "bogus"],
        not_a_module: ["read"],
        settings: [],
      }),
    ).toEqual({ students: ["read", "manage"] });
  });

  it("honours an allowed module list without mutating preserved hidden modules", () => {
    expect(normalizePermissionMap({ students: ["read"], finance: ["read"] }, ["students"])).toEqual(
      { students: ["read"] },
    );
  });
});

describe("normalizeWorkspaceRoles", () => {
  it("repairs malformed permissions and drops blank ids", () => {
    const roles = normalizeWorkspaceRoles([
      {
        id: "role_x",
        labelKey: "users.role.custom",
        descriptionKey: "users.role.customDesc",
        isSystem: false,
        badgeVariant: "primary",
        permissions: { students: ["read", "bogus"], not_a_module: ["read"] },
      },
      { id: "  ", permissions: {} },
    ]);
    expect(roles).toHaveLength(1);
    expect(roles?.[0]?.permissions).toEqual({ students: ["read"] });
  });
});

describe("serializeWorkspaceRoleWrite", () => {
  it("preserves existing role metadata while replacing editable fields", () => {
    const existing: WorkspaceRole = {
      id: "role_mentor",
      labelKey: "users.role.custom" as const,
      descriptionKey: "users.role.customDesc" as const,
      customLabel: "Old",
      isSystem: false,
      badgeVariant: "primary" as const,
      managedBy: "faculty_designations" as const,
      sourceRoleIds: ["b", "a", "a"],
      permissions: { students: ["read"] },
    };
    const serialized = serializeWorkspaceRoleWrite(
      {
        id: "role_mentor",
        name: "Mentor",
        description: "Mentor role",
        permissions: { students: ["create", "read"], finance: ["read"] },
      },
      existing,
    );
    expect(serialized).toMatchObject({
      id: "role_mentor",
      customLabel: "Mentor",
      customDescription: "Mentor role",
      isSystem: false,
      managedBy: "faculty_designations",
      sourceRoleIds: ["a", "b"],
      permissions: { students: ["create", "read"], finance: ["read"] },
    });
  });
});
