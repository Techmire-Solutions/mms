import { describe, expect, it } from "vitest";
import {
  activityActionMeta,
  canAccessRolesAndPermissions,
  canAssignRole,
  canManageRole,
  canManageTargetUser,
  cloneDefaultWorkspaceRoles,
  computeUserInitials,
  filterAssignableRoles,
  findWorkspaceRole,
  isAdminRole,
  isSuperAdminRole,
  normalizeWorkspaceUser,
  rbacModuleLabel,
  resolveRoleDisplayName,
  resolveWorkspaceRole,
  userStatusMeta,
  workspaceRoleDescription,
  workspaceRoleLabel,
} from "./userRoleUtils.js";
import { DEFAULT_WORKSPACE_ROLES } from "./userRbacDefaults.js";

describe("userRoleUtils", () => {
  describe("computeUserInitials", () => {
    it("computes 2-letter initials for multi-word names", () => {
      expect(computeUserInitials("John Doe")).toBe("JD");
      expect(computeUserInitials("Syed Ali Naqvi")).toBe("SN");
      expect(computeUserInitials("Admin")).toBe("AD");
    });

    it("handles blank/null names with fallback", () => {
      expect(computeUserInitials("")).toBe("U");
      expect(computeUserInitials(null)).toBe("U");
      expect(computeUserInitials(undefined, "X")).toBe("X");
    });
  });

  describe("normalizeWorkspaceUser", () => {
    it("handles empty/null payload safely", () => {
      const user = normalizeWorkspaceUser(null);
      expect(user.id).toBe("");
      expect(user.name).toBe("User");
      expect(user.role).toBe("teacher");
      expect(user.status).toBe("active");
    });

    it("falls back to loginEmail when email is missing", () => {
      const user = normalizeWorkspaceUser({
        loginEmail: "admin@madrasa.org",
      });
      expect(user.email).toBe("admin@madrasa.org");
      expect(user.name).toBe("admin@madrasa.org");
    });

    it("formats createdDate removing time portion if present", () => {
      const user = normalizeWorkspaceUser({
        createdDate: "2026-05-12T14:30:00Z",
      });
      expect(user.createdDate).toBe("2026-05-12");
    });
  });

  describe("role resolution & labels", () => {
    const mockTranslate = (k: string) => `translated:${k}`;

    it("findWorkspaceRole retrieves system role in O(1)", () => {
      const admin = findWorkspaceRole("admin");
      expect(admin).toBeDefined();
      expect(admin?.id).toBe("admin");
      expect(findWorkspaceRole("nonexistent")).toBeUndefined();
    });

    it("resolveWorkspaceRole searches custom role list", () => {
      const customRole = {
        id: "moderator",
        labelKey: "users.role.teacher" as const,
        descriptionKey: "users.role.teacherDesc" as const,
        isSystem: false,
        badgeVariant: "primary" as const,
        permissions: {},
      };
      expect(resolveWorkspaceRole("moderator", [customRole])).toEqual(customRole);
    });

    it("resolveRoleDisplayName resolves custom then system role then fallback", () => {
      const customRole = {
        id: "mentor",
        customLabel: "Madrasa Mentor",
        labelKey: "users.role.teacher" as const,
        descriptionKey: "users.role.teacherDesc" as const,
        isSystem: false,
        badgeVariant: "primary" as const,
        permissions: {},
      };
      expect(resolveRoleDisplayName("mentor", [customRole], mockTranslate)).toBe("Madrasa Mentor");
      expect(resolveRoleDisplayName("admin", [], mockTranslate)).toBe(
        "translated:users.role.admin",
      );
      expect(resolveRoleDisplayName("unknown_custom", [], mockTranslate)).toBe("unknown_custom");
    });

    it("workspaceRoleLabel respects customLabel override", () => {
      const role = {
        ...DEFAULT_WORKSPACE_ROLES[0]!,
        customLabel: "Super Admin Override",
      };
      expect(workspaceRoleLabel(role, mockTranslate)).toBe("Super Admin Override");
    });

    it("workspaceRoleDescription respects customDescription override", () => {
      const role = {
        ...DEFAULT_WORKSPACE_ROLES[0]!,
        customDescription: "Custom description text",
      };
      expect(workspaceRoleDescription(role, mockTranslate)).toBe("Custom description text");
    });

    it("cloneDefaultWorkspaceRoles deeply clones permissions", () => {
      const cloned = cloneDefaultWorkspaceRoles();
      expect(cloned.length).toBe(DEFAULT_WORKSPACE_ROLES.length);
      cloned[0]!.permissions["students"] = [];
      expect(DEFAULT_WORKSPACE_ROLES[0]!.permissions["students"]?.length).toBeGreaterThan(0);
    });
  });

  describe("lookups metadata", () => {
    const mockTranslate = (k: string) => `translated:${k}`;

    it("rbacModuleLabel translates known module or returns id", () => {
      expect(rbacModuleLabel("students", mockTranslate)).toBe("translated:nav.students");
      expect(rbacModuleLabel("nonexistent", mockTranslate)).toBe("nonexistent");
    });

    it("userStatusMeta and activityActionMeta return correct records", () => {
      expect(userStatusMeta("active")?.id).toBe("active");
      expect(activityActionMeta("login")?.id).toBe("login");
    });
  });

  describe("role governance & hierarchy", () => {
    it("isSuperAdminRole checks correctly", () => {
      expect(isSuperAdminRole("super_admin")).toBe(true);
      expect(isSuperAdminRole("SUPER_ADMIN")).toBe(true);
      expect(isSuperAdminRole("super_user")).toBe(true);
      expect(isSuperAdminRole("SUPER_USER")).toBe(true);
      expect(isSuperAdminRole("admin")).toBe(false);
      expect(isSuperAdminRole("teacher")).toBe(false);
      expect(isSuperAdminRole(undefined)).toBe(false);
    });

    it("isAdminRole checks correctly", () => {
      expect(isAdminRole("admin")).toBe(true);
      expect(isAdminRole("ADMIN")).toBe(true);
      expect(isAdminRole("super_admin")).toBe(false);
      expect(isAdminRole("super_user")).toBe(false);
      expect(isAdminRole("principal")).toBe(false);
    });

    it("canAccessRolesAndPermissions only grants access to super_admin and admin", () => {
      expect(canAccessRolesAndPermissions("super_admin")).toBe(true);
      expect(canAccessRolesAndPermissions("super_user")).toBe(true);
      expect(canAccessRolesAndPermissions("admin")).toBe(true);
      expect(canAccessRolesAndPermissions("principal")).toBe(false);
      expect(canAccessRolesAndPermissions("teacher")).toBe(false);
      expect(canAccessRolesAndPermissions("accountant")).toBe(false);
      expect(canAccessRolesAndPermissions(undefined)).toBe(false);
    });

    it("canManageRole: super_admin can manage any role, admin can manage all except super_admin", () => {
      expect(canManageRole("super_admin", "super_admin")).toBe(true);
      expect(canManageRole("super_admin", "admin")).toBe(true);
      expect(canManageRole("super_admin", "teacher")).toBe(true);
      expect(canManageRole("super_admin", "custom_role")).toBe(true);

      expect(canManageRole("admin", "super_admin")).toBe(false);
      expect(canManageRole("admin", "admin")).toBe(true);
      expect(canManageRole("admin", "teacher")).toBe(true);
      expect(canManageRole("admin", "custom_role")).toBe(true);

      expect(canManageRole("teacher", "teacher")).toBe(false);
      expect(canManageRole("principal", "teacher")).toBe(false);
    });

    it("canAssignRole: super_admin can assign any role, admin can assign any except super_admin", () => {
      expect(canAssignRole("super_admin", "super_admin")).toBe(true);
      expect(canAssignRole("super_admin", "admin")).toBe(true);
      expect(canAssignRole("super_admin", "teacher")).toBe(true);

      expect(canAssignRole("admin", "super_admin")).toBe(false);
      expect(canAssignRole("admin", "admin")).toBe(true);
      expect(canAssignRole("admin", "teacher")).toBe(true);

      expect(canAssignRole("teacher", "teacher")).toBe(false);
    });

    it("canManageTargetUser: admin cannot manage super_admin users", () => {
      expect(canManageTargetUser("super_admin", "super_admin")).toBe(true);
      expect(canManageTargetUser("super_admin", "admin")).toBe(true);
      expect(canManageTargetUser("super_admin", "teacher")).toBe(true);

      expect(canManageTargetUser("admin", "super_admin")).toBe(false);
      expect(canManageTargetUser("admin", "admin")).toBe(true);
      expect(canManageTargetUser("admin", "teacher")).toBe(true);

      expect(canManageTargetUser("teacher", "teacher")).toBe(false);
    });

    it("filterAssignableRoles filters out super_admin for admin actor and empties for non-admin", () => {
      const roles = DEFAULT_WORKSPACE_ROLES;

      const superAdminFiltered = filterAssignableRoles(roles, "super_admin");
      expect(superAdminFiltered.some((r) => r.id === "super_admin")).toBe(true);
      expect(superAdminFiltered.length).toBe(roles.length);

      const adminFiltered = filterAssignableRoles(roles, "admin");
      expect(adminFiltered.some((r) => r.id === "super_admin")).toBe(false);
      expect(adminFiltered.some((r) => r.id === "admin")).toBe(true);
      expect(adminFiltered.length).toBe(roles.length - 1);

      const teacherFiltered = filterAssignableRoles(roles, "teacher");
      expect(teacherFiltered).toEqual([]);
    });
  });
});
