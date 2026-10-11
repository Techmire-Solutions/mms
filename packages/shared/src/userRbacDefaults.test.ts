import { describe, expect, it } from "vitest";
import {
  ACTIVITY_ACTION_MAP,
  ACTIVITY_ACTIONS,
  ALL_RBAC_MODULE_IDS,
  ALL_SYSTEM_ROLE_IDS,
  clonePermissionMap,
  countGrantedActions,
  createEmptyPermissionMap,
  createFullPermissionMap,
  createReadOnlyPermissionMap,
  DEFAULT_WORKSPACE_ROLES,
  DEFAULT_WORKSPACE_ROLES_MAP,
  diffPermissionMaps,
  getDefaultRole,
  getRolePermissionActions,
  hasModuleAction,
  isEmptyPermissionMap,
  isFullPermissionMap,
  isPermissionMap,
  isSystemRole,
  isValidActivityAction,
  isValidUserStatus,
  mergePermissionMaps,
  USER_STATUS_MAP,
  USER_STATUSES,
} from "./userRbacDefaults.js";
import { PERMISSION_ACTIONS } from "./userEntityTypes.js";

describe("userRbacDefaults", () => {
  describe("permission map factories & utilities", () => {
    it("creates a full permission map with all actions", () => {
      const map = createFullPermissionMap(["students", "finance"]);
      expect(map.students).toEqual([...PERMISSION_ACTIONS]);
      expect(map.finance).toEqual([...PERMISSION_ACTIONS]);
      expect(map.teachers).toBeUndefined();
    });

    it("creates a default full permission map across all RBAC modules", () => {
      const map = createFullPermissionMap();
      expect(Object.keys(map).length).toBe(ALL_RBAC_MODULE_IDS.length);
      for (const modId of ALL_RBAC_MODULE_IDS) {
        expect(map[modId]).toEqual([...PERMISSION_ACTIONS]);
      }
    });

    it("creates read-only permission map", () => {
      const map = createReadOnlyPermissionMap(["dashboard", "students"]);
      expect(map.dashboard).toEqual(["read"]);
      expect(map.students).toEqual(["read"]);
    });

    it("creates empty permission map", () => {
      const map = createEmptyPermissionMap(["dashboard", "students"]);
      expect(map.dashboard).toEqual([]);
      expect(map.students).toEqual([]);
    });

    it("clones permission map isolating array references", () => {
      const original = { students: ["read", "create"] as const };
      const cloned = clonePermissionMap(original);
      expect(cloned).toEqual(original);
      expect(cloned.students).not.toBe(original.students);
    });

    it("merges permission maps correctly", () => {
      const base = { students: ["read"] as const, finance: ["read"] as const };
      const overrides = { students: ["read", "update"] as const, messaging: ["read"] as const };
      const merged = mergePermissionMaps(base, overrides);

      expect(merged.students).toEqual(["read", "update"]);
      expect(merged.finance).toEqual(["read"]);
      expect(merged.messaging).toEqual(["read"]);
    });

    it("counts granted actions and evaluates completeness", () => {
      const full = createFullPermissionMap(["students", "finance"]);
      expect(countGrantedActions(full)).toBe(8);
      expect(isFullPermissionMap(full, ["students", "finance"])).toBe(true);
      expect(isFullPermissionMap(full, ["students", "finance", "teachers"])).toBe(false);

      const empty = createEmptyPermissionMap(["students"]);
      expect(countGrantedActions(empty)).toBe(0);
      expect(isEmptyPermissionMap(empty)).toBe(true);
      expect(isEmptyPermissionMap(full)).toBe(false);
    });

    it("diffs permission maps identifying additions and removals", () => {
      const before = { students: ["read", "update"] as const, finance: ["read"] as const };
      const after = { students: ["read", "create"] as const, messaging: ["read"] as const };
      const diff = diffPermissionMaps(before, after);

      expect(diff.added.students).toEqual(["create"]);
      expect(diff.added.messaging).toEqual(["read"]);
      expect(diff.removed.students).toEqual(["update"]);
      expect(diff.removed.finance).toEqual(["read"]);
    });
  });

  describe("system roles & lookup maps", () => {
    it("identifies all 9 system roles correctly", () => {
      expect(ALL_SYSTEM_ROLE_IDS.length).toBe(9);
      expect(DEFAULT_WORKSPACE_ROLES.length).toBe(9);
      for (const roleId of ALL_SYSTEM_ROLE_IDS) {
        expect(isSystemRole(roleId)).toBe(true);
        expect(getDefaultRole(roleId)?.id).toBe(roleId);
      }
      expect(isSystemRole("custom_role")).toBe(false);
      expect(getDefaultRole("custom_role")).toBeUndefined();
    });

    it("provides fast O(1) role lookup and is frozen", () => {
      expect(DEFAULT_WORKSPACE_ROLES_MAP.super_admin.id).toBe("super_admin");
      expect(DEFAULT_WORKSPACE_ROLES_MAP.admin.id).toBe("admin");
      expect(DEFAULT_WORKSPACE_ROLES_MAP.principal.id).toBe("principal");
      expect(DEFAULT_WORKSPACE_ROLES_MAP.registrar.id).toBe("registrar");
      expect(DEFAULT_WORKSPACE_ROLES_MAP.teacher.permissions.students).toContain("read");
      expect(DEFAULT_WORKSPACE_ROLES_MAP.auditor.permissions.finance).toEqual(["read"]);
      expect(Object.isFrozen(DEFAULT_WORKSPACE_ROLES_MAP)).toBe(true);
    });

    it("super_admin and admin roles contain full permissions for all modules", () => {
      const superAdmin = DEFAULT_WORKSPACE_ROLES.find((r) => r.id === "super_admin");
      const admin = DEFAULT_WORKSPACE_ROLES.find((r) => r.id === "admin");
      expect(superAdmin?.id).toBe("super_admin");
      expect(admin?.id).toBe("admin");
      for (const modId of ALL_RBAC_MODULE_IDS) {
        expect(superAdmin?.permissions[modId]).toEqual([...PERMISSION_ACTIONS]);
        expect(admin?.permissions[modId]).toEqual([...PERMISSION_ACTIONS]);
      }
    });

    it("seeds tasks access without assign-anywhere for operational roles", () => {
      expect(DEFAULT_WORKSPACE_ROLES_MAP.principal.permissions.tasks).toEqual([
        "create",
        "read",
        "update",
      ]);
      expect(DEFAULT_WORKSPACE_ROLES_MAP.teacher.permissions.tasks).toEqual(["read"]);
      expect(DEFAULT_WORKSPACE_ROLES_MAP.registrar.permissions.tasks).toEqual(["read"]);
      expect(DEFAULT_WORKSPACE_ROLES_MAP.assistant_teacher.permissions.tasks).toEqual(["read"]);
      expect(
        DEFAULT_WORKSPACE_ROLES_MAP.principal.permissions["tasks.assign_anywhere"],
      ).toBeUndefined();
      expect(DEFAULT_WORKSPACE_ROLES_MAP.admin.permissions["tasks.assign_anywhere"]).toEqual([
        ...PERMISSION_ACTIONS,
      ]);
    });

    it("inspects role module actions safely", () => {
      const teacher = getDefaultRole("teacher");
      expect(getRolePermissionActions(teacher, "attendance")).toContain("create");
      expect(hasModuleAction(teacher, "attendance", "create")).toBe(true);
      expect(hasModuleAction(teacher, "finance", "create")).toBe(false);
      expect(hasModuleAction(null, "attendance", "create")).toBe(false);
    });
  });

  describe("type guards & lists", () => {
    it("validates user statuses and freezes map", () => {
      expect(USER_STATUSES).toEqual(["active", "inactive", "suspended"]);
      expect(Object.isFrozen(USER_STATUS_MAP)).toBe(true);
      expect(isValidUserStatus("active")).toBe(true);
      expect(isValidUserStatus("inactive")).toBe(true);
      expect(isValidUserStatus("suspended")).toBe(true);
      expect(isValidUserStatus("banned")).toBe(false);
      expect(isValidUserStatus(null)).toBe(false);
    });

    it("validates activity actions and freezes map", () => {
      expect(ACTIVITY_ACTIONS.length).toBe(6);
      expect(Object.isFrozen(ACTIVITY_ACTION_MAP)).toBe(true);
      expect(isValidActivityAction("login")).toBe(true);
      expect(isValidActivityAction("login_failed")).toBe(true);
      expect(isValidActivityAction("create")).toBe(true);
      expect(isValidActivityAction("update")).toBe(true);
      expect(isValidActivityAction("delete")).toBe(true);
      expect(isValidActivityAction("role_change")).toBe(true);
      expect(isValidActivityAction("export")).toBe(false);
      expect(isValidActivityAction(undefined)).toBe(false);
    });

    it("validates permission maps with isPermissionMap", () => {
      expect(isPermissionMap({ students: ["read", "create"] })).toBe(true);
      expect(isPermissionMap({ students: ["invalid_action"] })).toBe(false);
      expect(isPermissionMap(null)).toBe(false);
      expect(isPermissionMap("string")).toBe(false);
      expect(isPermissionMap([])).toBe(false);
    });
  });
});
