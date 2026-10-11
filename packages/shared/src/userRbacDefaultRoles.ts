import type { PermissionAction, WorkspaceRole } from "./userEntityTypes.js";
import {
  ALL_RBAC_MODULE_IDS,
  createFullPermissionMap,
  createReadOnlyPermissionMap,
} from "./userRbacPermissionMapOps.js";

/** Canonical tuple of all 9 institutional system role identifiers. */
export const ALL_SYSTEM_ROLE_IDS = [
  "super_admin",
  "admin",
  "principal",
  "registrar",
  "teacher",
  "assistant_teacher",
  "librarian",
  "accountant",
  "auditor",
] as const;

export type SystemRoleId = (typeof ALL_SYSTEM_ROLE_IDS)[number];

/** Default system roles shipped with every madrasa workspace. */
export const DEFAULT_WORKSPACE_ROLES: readonly WorkspaceRole[] = [
  {
    id: "super_admin",
    labelKey: "users.role.superAdmin",
    descriptionKey: "users.role.superAdminDesc",
    isSystem: true,
    badgeVariant: "destructive",
    permissions: createFullPermissionMap(ALL_RBAC_MODULE_IDS),
  },
  {
    id: "admin",
    labelKey: "users.role.admin",
    descriptionKey: "users.role.adminDesc",
    isSystem: true,
    badgeVariant: "destructive",
    permissions: createFullPermissionMap(ALL_RBAC_MODULE_IDS),
  },
  {
    id: "principal",
    labelKey: "users.role.principal",
    descriptionKey: "users.role.principalDesc",
    isSystem: true,
    badgeVariant: "primary",
    permissions: {
      dashboard: ["read"],
      contacts: ["create", "read", "update"],
      students: ["create", "read", "update"],
      faculty: ["create", "read", "update"],
      sessions: ["create", "read", "update"],
      attendance: ["create", "read", "update"],
      enrollments: ["create", "read", "update"],
      hasanat: ["create", "read", "update"],
      examinations: ["create", "read", "update", "delete"],
      questionBank: ["create", "read", "update", "delete"],
      finance: ["read"],
      accounting: ["read"],
      obligations: ["read"],
      messaging: ["create", "read", "update"],
      tasks: ["create", "read", "update"],
      users: ["read"],
      settings: ["read"],
    },
  },
  {
    id: "registrar",
    labelKey: "users.role.registrar",
    descriptionKey: "users.role.registrarDesc",
    isSystem: true,
    badgeVariant: "primary",
    permissions: {
      dashboard: ["read"],
      contacts: ["create", "read", "update", "delete"],
      students: ["create", "read", "update"],
      faculty: ["read"],
      sessions: ["read"],
      attendance: ["read"],
      enrollments: ["create", "read", "update", "delete"],
      hasanat: ["read"],
      examinations: ["read"],
      obligations: ["read"],
      messaging: ["create", "read"],
      tasks: ["read"],
    },
  },
  {
    id: "teacher",
    labelKey: "users.role.teacher",
    descriptionKey: "users.role.teacherDesc",
    isSystem: true,
    badgeVariant: "primary",
    permissions: {
      dashboard: ["read"],
      students: ["read", "update"],
      faculty: ["read", "update"],
      enrollments: ["create", "read", "update"],
      sessions: ["read", "update"],
      attendance: ["create", "read", "update"],
      examinations: ["create", "read", "update"],
      questionBank: ["create", "read", "update"],
      hasanat: ["create", "read", "update"],
      messaging: ["create", "read"],
      tasks: ["read"],
    },
  },
  {
    id: "assistant_teacher",
    labelKey: "users.role.assistantTeacher",
    descriptionKey: "users.role.assistantTeacherDesc",
    isSystem: true,
    badgeVariant: "primary",
    permissions: {
      dashboard: ["read"],
      students: ["read"],
      faculty: ["read"],
      sessions: ["read"],
      attendance: ["create", "read"],
      enrollments: ["read"],
      hasanat: ["read"],
      messaging: ["read"],
      tasks: ["read"],
    },
  },
  {
    id: "librarian",
    labelKey: "users.role.librarian",
    descriptionKey: "users.role.librarianDesc",
    isSystem: true,
    badgeVariant: "primary",
    permissions: {
      dashboard: ["read"],
      questionBank: ["create", "read", "update", "delete"],
      examinations: ["create", "read", "update"],
      students: ["read"],
      sessions: ["read"],
      messaging: ["read"],
    },
  },
  {
    id: "accountant",
    labelKey: "users.role.accountant",
    descriptionKey: "users.role.accountantDesc",
    isSystem: true,
    badgeVariant: "warning",
    permissions: {
      dashboard: ["read"],
      finance: ["create", "read", "update", "delete"],
      accounting: ["create", "read", "update", "delete"],
      obligations: ["create", "read", "update", "delete"],
      students: ["read"],
      enrollments: ["read"],
      contacts: ["read"],
      messaging: ["read"],
    },
  },
  {
    id: "auditor",
    labelKey: "users.role.auditor",
    descriptionKey: "users.role.auditorDesc",
    isSystem: true,
    badgeVariant: "muted",
    permissions: createReadOnlyPermissionMap(ALL_RBAC_MODULE_IDS),
  },
] as const;

/** Fast lookup map for default system roles by ID. */
export const DEFAULT_WORKSPACE_ROLES_MAP: Readonly<Record<string, WorkspaceRole>> = Object.freeze(
  Object.fromEntries(DEFAULT_WORKSPACE_ROLES.map((role) => [role.id, role])),
);

/** Retrieves default system role by role ID. */
export function getDefaultRole(roleId: string): WorkspaceRole | undefined {
  return DEFAULT_WORKSPACE_ROLES_MAP[roleId];
}

/** Returns true if a given role ID is a system-defined role. */
export function isSystemRole(roleId: string): roleId is SystemRoleId {
  return Object.prototype.hasOwnProperty.call(DEFAULT_WORKSPACE_ROLES_MAP, roleId);
}

/** Extracts granted actions for a module from a role object. */
export function getRolePermissionActions(
  role?: WorkspaceRole | null,
  moduleId?: string,
): readonly PermissionAction[] {
  if (!role || !moduleId) return [];
  return role.permissions[moduleId] ?? [];
}

/** Returns true if a role grants a specific action on a module. */
export function hasModuleAction(
  role: WorkspaceRole | null | undefined,
  moduleId: string,
  action: PermissionAction,
): boolean {
  return getRolePermissionActions(role, moduleId).includes(action);
}
