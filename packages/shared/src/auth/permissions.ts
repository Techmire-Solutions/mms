/**
 * @file permissions.ts
 * @description Single source of truth for dot-notation permission keys, dynamic role evaluation, and RBAC bridging.
 */

import type { WorkspaceRole } from "./userEntityTypes.js";
import { DEFAULT_WORKSPACE_ROLES_MAP } from "./userRbacDefaults.js";
import { PERMISSION_RULES } from "./permissionRules.js";

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
  "sessions.override_lock",
  "attendance.read",
  "attendance.write",
  "attendance.delete",
  "enrollments.read",
  "enrollments.write",
  "enrollments.delete",
  "hasanat.read",
  "hasanat.write",
  "hasanat.delete",
  "workshops.read",
  "workshops.write",
  "workshops.delete",
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
  "messaging.restoreLogs",
  "tasks.read",
  "tasks.write",
  "tasks.delete",
  "tasks.assign",
  "tasks.assign_anywhere",
  "tasks.complete",
  "users.read",
  "users.manage",
  "audit.view",
  "audit.manage",
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
