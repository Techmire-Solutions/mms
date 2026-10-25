import { describe, expect, it } from "vitest";
import {
  ALL_PERMISSIONS,
  getModulePermissions,
  getPermissionsForRole,
  getPermissionsForRoleObject,
  hasAllPermissions,
  hasAnyPermission,
  isValidPermission,
  roleHasPermission,
  roleObjectHasPermission,
} from "./permissions.js";
import type { WorkspaceRole } from "./userEntityTypes.js";

describe("roleHasPermission", () => {
  it("grants admin and super_admin full settings write and management", () => {
    expect(roleHasPermission("admin", "settings.branding.write")).toBe(true);
    expect(roleHasPermission("admin", "users.manage")).toBe(true);
    expect(roleHasPermission("super_admin", "settings.branding.write")).toBe(true);
    expect(roleHasPermission("super_admin", "users.manage")).toBe(true);
    expect(roleHasPermission("super_admin", "messaging.clearLogs")).toBe(true);
  });

  it("denies teacher access to administrative and financial modules", () => {
    expect(roleHasPermission("teacher", "users.manage")).toBe(false);
    expect(roleHasPermission("teacher", "configuration.view")).toBe(false);
    expect(roleHasPermission("teacher", "finance.write")).toBe(false);
    expect(roleHasPermission("teacher", "contacts.read")).toBe(false);
    expect(roleHasPermission("teacher", "contacts.write")).toBe(false);
    expect(roleHasPermission("assistant_teacher", "contacts.read")).toBe(false);
    expect(roleHasPermission("teacher", "students.write")).toBe(true);
  });

  it("grants accountant finance write", () => {
    expect(roleHasPermission("accountant", "finance.write")).toBe(true);
    expect(roleHasPermission("accountant", "settings.branding.write")).toBe(false);
  });

  it("denies accountant enrollments.write", () => {
    expect(roleHasPermission("accountant", "enrollments.write")).toBe(false);
  });

  it("grants teacher enrollments.write", () => {
    expect(roleHasPermission("teacher", "enrollments.write")).toBe(true);
  });

  it("grants dedicated messaging permissions by role", () => {
    expect(roleHasPermission("admin", "messaging.clearLogs")).toBe(true);
    expect(roleHasPermission("admin", "messaging.restoreLogs")).toBe(true);
    expect(roleHasPermission("teacher", "messaging.write")).toBe(true);
    expect(roleHasPermission("teacher", "messaging.clearLogs")).toBe(false);
    expect(roleHasPermission("teacher", "messaging.restoreLogs")).toBe(false);
    expect(roleHasPermission("accountant", "messaging.read")).toBe(true);
    expect(roleHasPermission("accountant", "messaging.write")).toBe(false);
  });

  it("grants dedicated hasanat permissions by role", () => {
    expect(roleHasPermission("admin", "hasanat.write")).toBe(true);
    expect(roleHasPermission("teacher", "hasanat.write")).toBe(true);
    expect(roleHasPermission("teacher", "hasanat.read")).toBe(true);
    expect(roleHasPermission("accountant", "hasanat.read")).toBe(false);
    expect(roleHasPermission("accountant", "hasanat.write")).toBe(false);
    expect(roleHasPermission("assistant_teacher", "hasanat.read")).toBe(true);
    expect(roleHasPermission("assistant_teacher", "hasanat.write")).toBe(false);
  });

  it("evaluates custom dynamic roles and customized permissions correctly", () => {
    const customSupervisorRole: WorkspaceRole = {
      id: "supervisor",
      labelKey: "users.role.custom",
      descriptionKey: "users.role.customDesc",
      customLabel: "Academic Supervisor",
      isSystem: false,
      badgeVariant: "primary",
      permissions: {
        students: ["read", "update"],
        faculty: ["read", "create", "update", "delete"],
        examinations: ["read", "create", "update", "delete"],
        users: ["read"],
      },
    };

    const customRoles = [customSupervisorRole];

    expect(roleHasPermission("supervisor", "faculty.write", customRoles)).toBe(true);
    expect(roleHasPermission("supervisor", "faculty.delete", customRoles)).toBe(true);
    expect(roleHasPermission("supervisor", "examinations.write", customRoles)).toBe(true);
    expect(roleHasPermission("supervisor", "students.write", customRoles)).toBe(true);
    expect(roleHasPermission("supervisor", "students.delete", customRoles)).toBe(false);
    expect(roleHasPermission("supervisor", "finance.write", customRoles)).toBe(false);
    expect(roleHasPermission("supervisor", "users.read", customRoles)).toBe(true);
    expect(roleHasPermission("supervisor", "users.manage", customRoles)).toBe(false);
  });

  it("allows customized permission overrides on default system roles", () => {
    const customTeacherRole: WorkspaceRole = {
      id: "teacher",
      labelKey: "users.role.teacher",
      descriptionKey: "users.role.teacherDesc",
      isSystem: true,
      badgeVariant: "primary",
      permissions: {
        students: ["read"],
        finance: ["read"], // customized permission granted
      },
    };

    expect(roleHasPermission("teacher", "finance.read", [customTeacherRole])).toBe(true);
    expect(roleHasPermission("teacher", "students.write", [customTeacherRole])).toBe(false);
  });
});

describe("roleObjectHasPermission & getPermissionsForRoleObject", () => {
  it("evaluates roleObject directly", () => {
    const role: WorkspaceRole = {
      id: "librarian",
      labelKey: "users.role.custom",
      descriptionKey: "users.role.customDesc",
      isSystem: false,
      badgeVariant: "primary",
      permissions: {
        questionBank: ["read", "create", "update"],
        dashboard: ["read"],
      },
    };

    expect(roleObjectHasPermission(role, "questionBank.write")).toBe(true);
    expect(roleObjectHasPermission(role, "questionBank.delete")).toBe(false);
    expect(roleObjectHasPermission(role, "analytics.view")).toBe(true);
    expect(roleObjectHasPermission(role, "configuration.view")).toBe(false);

    const perms = getPermissionsForRoleObject(role);
    expect(perms).toContain("questionBank.read");
    expect(perms).toContain("questionBank.write");
    expect(perms).not.toContain("questionBank.delete");
  });
});

describe("isValidPermission", () => {
  it("returns true for valid canonical permissions", () => {
    expect(isValidPermission("students.read")).toBe(true);
    expect(isValidPermission("finance.write")).toBe(true);
    expect(isValidPermission("messaging.clearLogs")).toBe(true);
  });

  it("returns false for invalid permission strings or non-strings", () => {
    expect(isValidPermission("invalid.permission")).toBe(false);
    expect(isValidPermission(null)).toBe(false);
    expect(isValidPermission(123)).toBe(false);
  });
});

describe("hasAnyPermission & hasAllPermissions", () => {
  it("evaluates hasAnyPermission correctly with static and custom roles", () => {
    expect(hasAnyPermission("teacher", ["finance.write", "students.read"])).toBe(true);
    expect(hasAnyPermission("teacher", ["finance.write", "users.manage"])).toBe(false);

    const customRole: WorkspaceRole = {
      id: "auditor",
      labelKey: "users.role.custom",
      descriptionKey: "users.role.customDesc",
      isSystem: false,
      badgeVariant: "warning",
      permissions: {
        finance: ["read"],
        accounting: ["read"],
      },
    };

    expect(hasAnyPermission("auditor", ["finance.read", "users.manage"], [customRole])).toBe(true);
    expect(hasAnyPermission("auditor", ["finance.write", "users.manage"], [customRole])).toBe(
      false,
    );
  });

  it("evaluates hasAllPermissions correctly with static and custom roles", () => {
    expect(hasAllPermissions("teacher", ["students.read", "students.write"])).toBe(true);
    expect(hasAllPermissions("teacher", ["students.read", "finance.write"])).toBe(false);
    expect(hasAllPermissions("admin", ["students.read", "finance.write", "users.manage"])).toBe(
      true,
    );

    const customRole: WorkspaceRole = {
      id: "auditor",
      labelKey: "users.role.custom",
      descriptionKey: "users.role.customDesc",
      isSystem: false,
      badgeVariant: "warning",
      permissions: {
        finance: ["read"],
        accounting: ["read"],
      },
    };

    expect(hasAllPermissions("auditor", ["finance.read", "accounting.read"], [customRole])).toBe(
      true,
    );
    expect(hasAllPermissions("auditor", ["finance.read", "finance.write"], [customRole])).toBe(
      false,
    );
  });
});

describe("getPermissionsForRole", () => {
  it("returns all permissions for admin, super_admin, and super_user", () => {
    expect(getPermissionsForRole("admin")).toEqual(ALL_PERMISSIONS);
    expect(getPermissionsForRole("super_admin")).toEqual(ALL_PERMISSIONS);
    expect(getPermissionsForRole("super_user")).toEqual(ALL_PERMISSIONS);
  });

  it("returns configured permission list for teacher and accountant", () => {
    const teacherPerms = getPermissionsForRole("teacher");
    expect(teacherPerms).toContain("students.read");
    expect(teacherPerms).not.toContain("users.manage");
  });

  it("returns permissions for dynamic custom roles", () => {
    const customRole: WorkspaceRole = {
      id: "custom_editor",
      labelKey: "users.role.custom",
      descriptionKey: "users.role.customDesc",
      isSystem: false,
      badgeVariant: "primary",
      permissions: {
        students: ["read", "update"],
      },
    };
    const perms = getPermissionsForRole("custom_editor", [customRole]);
    expect(perms).toContain("students.read");
    expect(perms).toContain("students.write");
    expect(perms).not.toContain("students.delete");
    expect(perms).not.toContain("finance.read");
  });

  it("returns empty array for unknown role or undefined", () => {
    expect(getPermissionsForRole("unknown_role")).toEqual([]);
    expect(getPermissionsForRole(undefined)).toEqual([]);
  });
});

describe("getModulePermissions", () => {
  it("returns all permissions for a specific module", () => {
    const studentPerms = getModulePermissions("students");
    expect(studentPerms).toEqual(["students.read", "students.write", "students.delete"]);

    const financePerms = getModulePermissions("finance");
    expect(financePerms).toEqual(["finance.read", "finance.write", "finance.delete"]);

    const messagingPerms = getModulePermissions("messaging");
    expect(messagingPerms).toEqual([
      "messaging.read",
      "messaging.write",
      "messaging.clearLogs",
      "messaging.restoreLogs",
    ]);
  });

  it("returns empty array for unknown module", () => {
    expect(getModulePermissions("unknown_module")).toEqual([]);
  });
});

describe("sessions.override_lock", () => {
  // The lifecycle edit lock (Phase 4) may only be overridden by roles with full

  // structural authority over sessions. Pins the holder set so a role-default edit

  // cannot silently widen it.

  it("is held by exactly super_admin and admin", () => {
    expect(roleHasPermission("super_admin", "sessions.override_lock")).toBe(true);

    expect(roleHasPermission("admin", "sessions.override_lock")).toBe(true);

    for (const role of [
      "principal",

      "registrar",

      "teacher",

      "assistant_teacher",

      "librarian",

      "accountant",

      "auditor",
    ] as const) {
      expect(roleHasPermission(role, "sessions.override_lock")).toBe(false);
    }
  });

  it("is stricter than ordinary session editing", () => {
    // principal may create and update sessions but must not override the lock.

    expect(roleHasPermission("principal", "sessions.write")).toBe(true);

    expect(roleHasPermission("principal", "sessions.override_lock")).toBe(false);
  });

  it("is a registered permission key", () => {
    expect(ALL_PERMISSIONS).toContain("sessions.override_lock");

    expect(isValidPermission("sessions.override_lock")).toBe(true);
  });
});
