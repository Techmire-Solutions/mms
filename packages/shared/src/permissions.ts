/**
 * @file permissions.ts
 * @description Single source of truth for dot-notation permission keys, dynamic role evaluation, and RBAC bridging.
 */

import type { PermissionAction, WorkspaceRole } from "./userEntityTypes.js";
import { DEFAULT_WORKSPACE_ROLES_MAP } from "./userRbacDefaults.js";

/** Canonical tuple of all available permission keys in MMS. */
export const ALL_PERMISSIONS = [
  "contacts.read",
  "contacts.write",
  "contacts.delete",
  "students.read",
  "students.write",
  "students.delete",
  "faculty.read",
  "faculty.write",
  "faculty.delete",
  "sessions.read",
  "sessions.write",
  "sessions.delete",
  "attendance.read",
  "attendance.write",
  "attendance.delete",
  "enrollments.read",
  "enrollments.write",
  "enrollments.delete",
  "hasanat.read",
  "hasanat.write",
  "hasanat.delete",
  "examinations.read",
  "examinations.write",
  "examinations.delete",
  "questionBank.read",
  "questionBank.write",
  "questionBank.delete",
  "finance.read",
  "finance.write",
  "finance.delete",
  "accounting.read",
  "accounting.write",
  "accounting.delete",
  "obligations.read",
  "obligations.write",
  "obligations.delete",
  "messaging.read",
  "messaging.write",
  "messaging.clearLogs",
  "tasks.read",
  "tasks.write",
  "tasks.delete",
  "tasks.assign",
  "tasks.assign_anywhere",
  "tasks.complete",
  "users.read",
  "users.manage",
  "analytics.view",
  "configuration.view",
  "settings.global.write",
  "settings.branding.write",
] as const;

/** Dot-notation permission keys — align with `mms-rbac` registry vocabulary. */
export type Permission = (typeof ALL_PERMISSIONS)[number];

const PERMISSIONS_SET = new Set<string>(ALL_PERMISSIONS);

/** Runtime type guard checking if a string is a valid MMS permission key. */
export function isValidPermission(permission: unknown): permission is Permission {
  return typeof permission === "string" && PERMISSIONS_SET.has(permission);
}

/** Pre-computed static evaluator map for $O(1)$ zero-allocation evaluation. */
interface PermissionRule {
  readonly module: string;
  readonly requiredActions: readonly PermissionAction[];
  readonly fallbackModules?: readonly string[];
}

const PERMISSION_RULES: Readonly<Record<Permission, PermissionRule>> = Object.freeze({
  // Contacts
  "contacts.read": { module: "contacts", requiredActions: ["read"] },
  "contacts.write": { module: "contacts", requiredActions: ["create", "update"] },
  "contacts.delete": { module: "contacts", requiredActions: ["delete"] },

  // Students
  "students.read": { module: "students", requiredActions: ["read"] },
  "students.write": { module: "students", requiredActions: ["create", "update"] },
  "students.delete": { module: "students", requiredActions: ["delete"] },

  // Faculty
  "faculty.read": { module: "faculty", requiredActions: ["read"] },
  "faculty.write": { module: "faculty", requiredActions: ["create", "update"] },
  "faculty.delete": { module: "faculty", requiredActions: ["delete"] },

  // Sessions
  "sessions.read": { module: "sessions", requiredActions: ["read"] },
  "sessions.write": { module: "sessions", requiredActions: ["create", "update"] },
  "sessions.delete": { module: "sessions", requiredActions: ["delete"] },

  // Attendance
  "attendance.read": { module: "attendance", requiredActions: ["read"] },
  "attendance.write": { module: "attendance", requiredActions: ["create", "update"] },
  "attendance.delete": { module: "attendance", requiredActions: ["delete"] },

  // Enrollments
  "enrollments.read": { module: "enrollments", requiredActions: ["read"] },
  "enrollments.write": { module: "enrollments", requiredActions: ["create", "update"] },
  "enrollments.delete": { module: "enrollments", requiredActions: ["delete"] },

  // Hasanat Cards
  "hasanat.read": { module: "hasanat", requiredActions: ["read"] },
  "hasanat.write": { module: "hasanat", requiredActions: ["create", "update"] },
  "hasanat.delete": { module: "hasanat", requiredActions: ["delete"] },

  // Examinations
  "examinations.read": { module: "examinations", requiredActions: ["read"] },
  "examinations.write": { module: "examinations", requiredActions: ["create", "update"] },
  "examinations.delete": { module: "examinations", requiredActions: ["delete"] },

  // Question Bank
  "questionBank.read": { module: "questionBank", requiredActions: ["read"] },
  "questionBank.write": { module: "questionBank", requiredActions: ["create", "update"] },
  "questionBank.delete": { module: "questionBank", requiredActions: ["delete"] },

  // Finance & Accounting
  "finance.read": { module: "finance", requiredActions: ["read"] },
  "finance.write": { module: "finance", requiredActions: ["create", "update"] },
  "finance.delete": { module: "finance", requiredActions: ["delete"] },
  "accounting.read": { module: "accounting", requiredActions: ["read"] },
  "accounting.write": { module: "accounting", requiredActions: ["create", "update"] },
  "accounting.delete": { module: "accounting", requiredActions: ["delete"] },
  "obligations.read": { module: "obligations", requiredActions: ["read"] },
  "obligations.write": { module: "obligations", requiredActions: ["create", "update"] },
  "obligations.delete": { module: "obligations", requiredActions: ["delete"] },

  // Messaging
  "messaging.read": { module: "messaging", requiredActions: ["read"] },
  "messaging.write": { module: "messaging", requiredActions: ["create", "update"] },
  "messaging.clearLogs": { module: "messaging", requiredActions: ["delete"] },

  // Tasks
  "tasks.read": { module: "tasks", requiredActions: ["read"] },
  "tasks.write": { module: "tasks", requiredActions: ["create", "update"] },
  "tasks.delete": { module: "tasks", requiredActions: ["delete"] },
  "tasks.assign": { module: "tasks", requiredActions: ["create", "update"] },
  "tasks.assign_anywhere": { module: "tasks.assign_anywhere", requiredActions: ["update"] },
  "tasks.complete": { module: "tasks", requiredActions: ["update"] },

  // Users & Administration
  "users.read": { module: "users", requiredActions: ["read"] },
  "users.manage": { module: "users", requiredActions: ["create", "update", "delete"] },

  // System & Settings
  "analytics.view": {
    module: "dashboard",
    requiredActions: ["read"],
    fallbackModules: ["students"],
  },
  "configuration.view": { module: "settings", requiredActions: ["read"] },
  "settings.global.write": { module: "settings", requiredActions: ["create", "update"] },
  "settings.branding.write": { module: "settings", requiredActions: ["create", "update"] },
});

/**
 * Evaluates whether a WorkspaceRole object grants a specific dot-notation permission.
 */
export function roleObjectHasPermission(role: WorkspaceRole, permission: Permission): boolean {
  if (role.id === "admin" || role.id === "super_admin") {
    return true;
  }

  const rule = PERMISSION_RULES[permission];
  if (!rule) return false;

  const perms = role.permissions || {};
  const actions = perms[rule.module] || [];

  const hasDirectAction = rule.requiredActions.some((a) => actions.includes(a));
  if (hasDirectAction) return true;

  if (rule.fallbackModules && rule.fallbackModules.length > 0) {
    return rule.fallbackModules.some((fbModule) => {
      const fbActions = perms[fbModule] || [];
      return rule.requiredActions.some((a) => fbActions.includes(a));
    });
  }

  return false;
}

/**
 * Returns all permissions granted to a dynamic WorkspaceRole object.
 */
export function getPermissionsForRoleObject(role: WorkspaceRole): readonly Permission[] {
  if (role.id === "admin" || role.id === "super_admin" || role.id === "super_user") {
    return ALL_PERMISSIONS;
  }
  return ALL_PERMISSIONS.filter((p) => roleObjectHasPermission(role, p));
}

/**
 * Returns whether a workspace role grants a specific permission, supporting custom dynamic roles.
 */
export function roleHasPermission(
  role: string | undefined,
  permission: Permission,
  customRoles?: readonly WorkspaceRole[],
): boolean {
  const normalized = (role ?? "").trim().toLowerCase();
  if (normalized === "admin" || normalized === "super_admin" || normalized === "super_user") {
    return true;
  }

  // Check custom workspace roles
  if (customRoles && customRoles.length > 0) {
    const matched = customRoles.find((r) => r.id.toLowerCase() === normalized);
    if (matched) {
      return roleObjectHasPermission(matched, permission);
    }
  }

  // Check default system roles or alias (e.g. 'staff' -> 'teacher')
  const defaultRole =
    DEFAULT_WORKSPACE_ROLES_MAP[normalized] ??
    (normalized === "staff" ? DEFAULT_WORKSPACE_ROLES_MAP["teacher"] : undefined);
  if (defaultRole) {
    return roleObjectHasPermission(defaultRole, permission);
  }

  return false;
}

/**
 * Returns whether a role has ANY of the specified permissions.
 */
export function hasAnyPermission(
  role: string | undefined,
  permissions: readonly Permission[],
  customRoles?: readonly WorkspaceRole[],
): boolean {
  return permissions.some((permission) => roleHasPermission(role, permission, customRoles));
}

/**
 * Returns whether a role has ALL of the specified permissions.
 */
export function hasAllPermissions(
  role: string | undefined,
  permissions: readonly Permission[],
  customRoles?: readonly WorkspaceRole[],
): boolean {
  return permissions.every((permission) => roleHasPermission(role, permission, customRoles));
}

/**
 * Returns the complete list of permissions granted to a role.
 */
export function getPermissionsForRole(
  role: string | undefined,
  customRoles?: readonly WorkspaceRole[],
): readonly Permission[] {
  const normalized = (role ?? "").trim().toLowerCase();
  if (normalized === "admin" || normalized === "super_admin" || normalized === "super_user") {
    return ALL_PERMISSIONS;
  }

  if (customRoles && customRoles.length > 0) {
    const matched = customRoles.find((r) => r.id.toLowerCase() === normalized);
    if (matched) {
      return getPermissionsForRoleObject(matched);
    }
  }

  const defaultRole =
    DEFAULT_WORKSPACE_ROLES_MAP[normalized] ??
    (normalized === "staff" ? DEFAULT_WORKSPACE_ROLES_MAP["teacher"] : undefined);
  if (defaultRole) {
    return getPermissionsForRoleObject(defaultRole);
  }

  return [];
}

/**
 * Returns all permission keys related to a specific module.
 */
export function getModulePermissions(moduleId: string): readonly Permission[] {
  return ALL_PERMISSIONS.filter((p) => {
    const rule = PERMISSION_RULES[p];
    return rule && rule.module === moduleId;
  });
}
