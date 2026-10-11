/**
 * @file userRoleUtils.ts
 * @description Pure utility functions for workspace users, roles, statuses, and permissions.
 */

import type { AppTranslationKey } from "./appTranslations.js";
import type {
  ActivityAction,
  UserStatus,
  WorkspaceRole,
  WorkspaceUser,
} from "./userEntityTypes.js";
import {
  ACTIVITY_ACTION_MAP,
  DEFAULT_WORKSPACE_ROLES,
  DEFAULT_WORKSPACE_ROLES_MAP,
  getRbacModuleDef,
  USER_STATUS_MAP,
} from "./userRbacRegistry.js";
import { excludeFacultyManagedRoles, isFacultyManagedRoleId } from "./userRolePrivilege.js";

/** Computes uppercase 1-2 letter initials from a user's display name or email. */
export function computeUserInitials(name?: string | null, fallback = "U"): string {
  if (!name || !name.trim()) return fallback;
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;
  if (parts.length === 1) return (parts[0]?.slice(0, 2) || fallback).toUpperCase();
  return ((parts[0]?.[0] || "") + (parts[parts.length - 1]?.[0] || "")).toUpperCase() || fallback;
}

/**
 * Normalizes stored/API user payloads to the workspace UI model (singular `role`).
 */
export function normalizeWorkspaceUser(
  raw?: (Partial<WorkspaceUser> & { roles?: string[]; role?: string; createdAt?: string }) | null,
): WorkspaceUser {
  const data = raw || {};
  const role =
    typeof data.role === "string" && data.role.trim()
      ? data.role.trim()
      : Array.isArray(data.roles) && data.roles[0]
        ? data.roles[0]
        : "teacher";

  const email =
    (typeof data.email === "string" && data.email.trim()) ||
    (typeof data.loginEmail === "string" && data.loginEmail.trim()) ||
    "";
  const name = (typeof data.name === "string" && data.name.trim()) || email || "User";
  const initials =
    (typeof data.avatarInitials === "string" && data.avatarInitials.trim()) ||
    computeUserInitials(name);

  const created = data.createdDate ?? data.createdAt ?? "";

  return {
    id: data.id ?? "",
    contactId: data.contactId,
    name,
    email,
    loginEmail: typeof data.loginEmail === "string" ? data.loginEmail : undefined,
    mustChangePassword: data.mustChangePassword === true,
    phone: data.phone ?? "",
    role,
    status: data.status ?? "active",
    roleSource:
      data.roleSource === "faculty_designations" || isFacultyManagedRoleId(role)
        ? "faculty_designations"
        : data.roleSource === "manual"
          ? "manual"
          : undefined,
    twoFactorEnabled: data.twoFactorEnabled ?? false,
    lastLogin: data.lastLogin ?? "",
    createdDate: created.includes("T") ? created.split("T")[0] : created,
    failedLoginAttempts: data.failedLoginAttempts ?? 0,
    activeSessions: data.activeSessions ?? 0,
    avatarInitials: initials,
    deletedAt: data.deletedAt ?? null,
    deletedBy: data.deletedBy ?? null,
    emailVerifiedAt:
      typeof data.emailVerifiedAt === "string"
        ? data.emailVerifiedAt
        : data.emailVerifiedAt
          ? String(data.emailVerifiedAt)
          : null,
  };
}

/** Clones default system roles for editable local state. */
export function cloneDefaultWorkspaceRoles(): WorkspaceRole[] {
  return DEFAULT_WORKSPACE_ROLES.map((workspaceRole) => ({
    ...workspaceRole,
    permissions: structuredClone(workspaceRole.permissions),
  }));
}

/** Resolves a workspace role by ID from a custom list. */
export function resolveWorkspaceRole(
  roleId: string,
  roles: readonly WorkspaceRole[],
): WorkspaceRole | undefined {
  return roles.find((workspaceRole) => workspaceRole.id === roleId);
}

/** Resolves a default system role by ID via fast O(1) lookup. */
export function findWorkspaceRole(roleId: string): WorkspaceRole | undefined {
  return DEFAULT_WORKSPACE_ROLES_MAP[roleId];
}

/** Resolved display label for a workspace role (custom or translated). */
export function workspaceRoleLabel(
  role: WorkspaceRole,
  t: (key: AppTranslationKey) => string,
): string {
  return role.customLabel?.trim() || t(role.labelKey);
}

/** Resolved description for a workspace role (custom or translated). */
export function workspaceRoleDescription(
  role: WorkspaceRole,
  t: (key: AppTranslationKey) => string,
): string {
  return role.customDescription?.trim() || t(role.descriptionKey);
}

/** Resolves the display label for any role ID (checking custom roles, then system roles). */
export function resolveRoleDisplayName(
  roleId: string,
  customRoles: readonly WorkspaceRole[] = [],
  t: (key: AppTranslationKey) => string,
): string {
  const custom = customRoles.find((r) => r.id === roleId);
  if (custom) return workspaceRoleLabel(custom, t);
  const system = findWorkspaceRole(roleId);
  if (system) return workspaceRoleLabel(system, t);
  return roleId;
}

/** Resolves translated label for an RBAC module. */
export function rbacModuleLabel(moduleId: string, t: (key: AppTranslationKey) => string): string {
  const mod = getRbacModuleDef(moduleId);
  return mod ? t(mod.labelKey) : moduleId;
}

/** Metadata lookup for user statuses. */
export function userStatusMeta(
  status: UserStatus,
): (typeof USER_STATUS_MAP)[UserStatus] | undefined {
  return USER_STATUS_MAP[status];
}

/** Metadata lookup for user activity actions. */
export function activityActionMeta(
  action: ActivityAction,
): (typeof ACTIVITY_ACTION_MAP)[ActivityAction] | undefined {
  return ACTIVITY_ACTION_MAP[action];
}

/** Whether the given role ID corresponds to Super Admin. */
export function isSuperAdminRole(role: string | undefined): boolean {
  const normalized = (role ?? "").trim().toLowerCase();
  return normalized === "super_admin" || normalized === "super_user";
}

/** Whether the given role ID corresponds to standard Admin. */
export function isAdminRole(role: string | undefined): boolean {
  return (role ?? "").trim().toLowerCase() === "admin";
}

/**
 * Whether the actor role is allowed to view and access Roles & Permissions administration.
 * Strictly restricted to Super Admin and Admin. All other roles return false.
 */
export function canAccessRolesAndPermissions(actorRole: string | undefined): boolean {
  const normalized = (actorRole ?? "").trim().toLowerCase();
  return normalized === "super_admin" || normalized === "super_user" || normalized === "admin";
}

/**
 * Whether the actor role can create, modify, or delete the target role or its permissions.
 * - Super Admin can manage ANY role (including Super Admin).
 * - Admin can manage standard and custom roles, but CANNOT change Super Admin.
 * - Other roles cannot manage any roles.
 */
export function canManageRole(
  actorRole: string | undefined,
  targetRoleOrId: WorkspaceRole | string | undefined,
): boolean {
  if (!canAccessRolesAndPermissions(actorRole)) return false;
  if (isSuperAdminRole(actorRole)) return true;

  const targetId = typeof targetRoleOrId === "string" ? targetRoleOrId : targetRoleOrId?.id;
  if (isSuperAdminRole(targetId)) return false;

  return true;
}

/**
 * Whether the actor role can assign a specific role to a user.
 * - Super Admin can assign ANY role (including Super Admin).
 * - Admin can assign any role EXCEPT Super Admin.
 * - Other roles cannot assign roles.
 */
export function canAssignRole(
  actorRole: string | undefined,
  roleToAssign: string | undefined,
): boolean {
  if (!canAccessRolesAndPermissions(actorRole)) return false;
  if (isSuperAdminRole(actorRole)) return true;
  if (isSuperAdminRole(roleToAssign)) return false;
  return true;
}

/**
 * Whether the actor role can edit, delete, or reset the password of a target user.
 * - Super Admin can manage ANY user account.
 * - Admin can manage non-Super-Admin accounts, but CANNOT modify Super Admin users.
 * - Other roles cannot manage user accounts.
 */
export function canManageTargetUser(
  actorRole: string | undefined,
  targetUserRole: string | undefined,
): boolean {
  if (!canAccessRolesAndPermissions(actorRole)) return false;
  if (isSuperAdminRole(actorRole)) return true;
  if (isSuperAdminRole(targetUserRole)) return false;
  return true;
}

/**
 * Filters the list of assignable workspace roles according to the actor's authorization.
 * - Super Admin sees all roles (including Super Admin).
 * - Admin sees all roles except Super Admin.
 * - Other roles receive an empty list.
 */
export function filterAssignableRoles(
  roles: readonly WorkspaceRole[],
  actorRole: string | undefined,
): WorkspaceRole[] {
  if (!canAccessRolesAndPermissions(actorRole)) return [];
  const visible = excludeFacultyManagedRoles(roles);
  if (isSuperAdminRole(actorRole)) return [...visible];
  return visible.filter((r) => !isSuperAdminRole(r.id));
}
