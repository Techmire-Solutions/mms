import { describe, expect, it } from "vitest";
import { DEFAULT_WORKSPACE_ROLES_MAP, unionPermissionMaps } from "./userRbacDefaults.js";
import type { WorkspaceRole } from "./userEntityTypes.js";
import {
  buildFacultyCompositeRole,
  buildFacultyManagedRoleId,
  collectActiveTenureAssignableRoleIds,
  excludeFacultyManagedRoles,
  isActiveOpenEmployDesignationTenure,
  isFacultyManagedRole,
  isFacultyManagedRoleId,
  preserveFacultyManagedRoles,
  refreshFacultyManagedRolePermissions,
  resolveFacultyDesignationRoleAssignment,
} from "./userRolePrivilege.js";

describe("userRolePrivilege", () => {
  describe("isActiveOpenEmployDesignationTenure", () => {
    it("requires active status and no end date", () => {
      expect(
        isActiveOpenEmployDesignationTenure({
          designationId: "d1",
          employDesignationStatus: "active",
          designationEndDate: null,
        }),
      ).toBe(true);
      expect(
        isActiveOpenEmployDesignationTenure({
          designationId: "d1",
          employDesignationStatus: "active",
          designationEndDate: "2024-01-01",
        }),
      ).toBe(false);
    });
  });

  describe("collectActiveTenureAssignableRoleIds", () => {
    it("unions distinct roles from active open tenures only", () => {
      const byId = new Map([
        ["d1", { id: "d1", status: "active" as const, assignableRoles: ["teacher"] }],
        ["d2", { id: "d2", status: "active" as const, assignableRoles: ["admin"] }],
        ["d3", { id: "d3", status: "active" as const, assignableRoles: ["super_admin"] }],
      ]);
      const ids = collectActiveTenureAssignableRoleIds(
        [
          { designationId: "d1", employDesignationStatus: "active", designationEndDate: null },
          { designationId: "d2", employDesignationStatus: "active", designationEndDate: null },
          { designationId: "d3", employDesignationStatus: "active", designationEndDate: null },
        ],
        byId,
      );
      expect(ids).toEqual(["admin", "teacher"]);
    });
  });

  describe("unionPermissionMaps", () => {
    it("unions actions per module", () => {
      const teacher = DEFAULT_WORKSPACE_ROLES_MAP.teacher!.permissions;
      const accountant = DEFAULT_WORKSPACE_ROLES_MAP.accountant!.permissions;
      const merged = unionPermissionMaps([teacher, accountant]);
      expect(merged.students).toEqual(expect.arrayContaining(["read", "update"]));
      expect(merged.finance).toEqual(
        expect.arrayContaining(["create", "read", "update", "delete"]),
      );
    });
  });

  describe("managed role ids", () => {
    it("builds stable sanitized ids", () => {
      expect(buildFacultyManagedRoleId("C-1")).toBe("faculty_ed_c-1");
      expect(isFacultyManagedRoleId("faculty_ed_c-1")).toBe(true);
      expect(isFacultyManagedRoleId("teacher")).toBe(false);
    });
  });

  describe("resolveFacultyDesignationRoleAssignment", () => {
    it("returns none when no assignable roles", () => {
      expect(
        resolveFacultyDesignationRoleAssignment(
          "c1",
          [{ designationId: "d1", employDesignationStatus: "active", designationEndDate: null }],
          [{ id: "d1", status: "active", assignableRoles: [] }],
        ),
      ).toEqual({ kind: "none", sourceRoleIds: [] });
    });

    it("returns catalog for a single source role", () => {
      const result = resolveFacultyDesignationRoleAssignment(
        "c1",
        [{ designationId: "d1", employDesignationStatus: "active", designationEndDate: null }],
        [{ id: "d1", status: "active", assignableRoles: ["teacher"] }],
      );
      expect(result).toEqual({ kind: "catalog", roleId: "teacher", sourceRoleIds: ["teacher"] });
    });

    it("returns composite union for multiple source roles", () => {
      const catalog = [
        DEFAULT_WORKSPACE_ROLES_MAP.teacher!,
        DEFAULT_WORKSPACE_ROLES_MAP.accountant!,
      ];
      const result = resolveFacultyDesignationRoleAssignment(
        "c1",
        [
          { designationId: "d1", employDesignationStatus: "active", designationEndDate: null },
          { designationId: "d2", employDesignationStatus: "active", designationEndDate: null },
        ],
        [
          { id: "d1", status: "active", assignableRoles: ["teacher"] },
          { id: "d2", status: "active", assignableRoles: ["accountant"] },
        ],
        catalog,
      );
      expect(result.kind).toBe("composite");
      expect(result.roleId).toBe("faculty_ed_c1");
      expect(result.composite?.permissions.finance).toContain("create");
      expect(result.composite?.permissions.students).toContain("read");
      expect(result.composite?.managedBy).toBe("faculty_designations");
      expect(isFacultyManagedRole(result.composite)).toBe(true);
    });
  });

  describe("preserve and exclude managed roles", () => {
    it("excludes managed roles from assignable lists", () => {
      const managed = buildFacultyCompositeRole({
        contactId: "c1",
        sourceRoles: [
          DEFAULT_WORKSPACE_ROLES_MAP.teacher!,
          DEFAULT_WORKSPACE_ROLES_MAP.accountant!,
        ],
      });
      expect(
        excludeFacultyManagedRoles([DEFAULT_WORKSPACE_ROLES_MAP.teacher!, managed]),
      ).toHaveLength(1);
    });

    it("preserves server managed roles omitted by client save", () => {
      const managed = buildFacultyCompositeRole({
        contactId: "c1",
        sourceRoles: [
          DEFAULT_WORKSPACE_ROLES_MAP.teacher!,
          DEFAULT_WORKSPACE_ROLES_MAP.accountant!,
        ],
      });
      const preserved = preserveFacultyManagedRoles(
        [DEFAULT_WORKSPACE_ROLES_MAP.admin!],
        [DEFAULT_WORKSPACE_ROLES_MAP.admin!, managed],
      );
      expect(preserved.some((r) => r.id === managed.id)).toBe(true);
    });

    it("refreshes managed role permissions from catalog", () => {
      const managed = buildFacultyCompositeRole({
        contactId: "c1",
        sourceRoles: [
          DEFAULT_WORKSPACE_ROLES_MAP.teacher!,
          DEFAULT_WORKSPACE_ROLES_MAP.accountant!,
        ],
      });
      const stale: WorkspaceRole = {
        ...managed,
        permissions: { students: ["read"] },
      };
      const refreshed = refreshFacultyManagedRolePermissions(
        [stale],
        [DEFAULT_WORKSPACE_ROLES_MAP.teacher!, DEFAULT_WORKSPACE_ROLES_MAP.accountant!],
      );
      expect(refreshed[0]?.permissions.finance).toContain("create");
    });
  });
});
