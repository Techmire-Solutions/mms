/**
 * @file userRbacDefaults.ts
 * @description Default system roles, user status registries, activity registries, and permission map factories.
 */

import type { AppTranslationKey } from "./appTranslations.js";
import type {
  ActivityAction,
  PermissionAction,
  PermissionMap,
  UserBadgeVariant,
  UserStatus,
  WorkspaceRole,
} from "./userEntityTypes.js";
import { PERMISSION_ACTIONS } from "./userEntityTypes.js";
import { RBAC_MODULE_IDS, type RbacModuleId } from "./userRbacModuleRegistry.js";

export const ALL_RBAC_MODULE_IDS: readonly RbacModuleId[] = RBAC_MODULE_IDS;

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

/**
 * Creates a permission map granting all actions across the given (or all) modules.
 */
export function createFullPermissionMap(
  moduleIds: readonly (string | RbacModuleId)[] = ALL_RBAC_MODULE_IDS,
): PermissionMap {
  const p: PermissionMap = {};
  for (const m of moduleIds) {
    p[m] = [...PERMISSION_ACTIONS];
  }
  return p;
}

/**
 * Creates a permission map granting read-only access across the given (or all) modules.
 */
export function createReadOnlyPermissionMap(
  moduleIds: readonly (string | RbacModuleId)[] = ALL_RBAC_MODULE_IDS,
): PermissionMap {
  const p: PermissionMap = {};
  for (const m of moduleIds) {
    p[m] = ["read"];
  }
  return p;
}

/**
 * Creates an empty permission map for the given (or all) modules.
 */
export function createEmptyPermissionMap(
  moduleIds: readonly (string | RbacModuleId)[] = ALL_RBAC_MODULE_IDS,
): PermissionMap {
  const p: PermissionMap = {};
  for (const m of moduleIds) {
    p[m] = [];
  }
  return p;
}

export type ReadonlyPermissionMap = Readonly<Record<string, readonly PermissionAction[]>>;

/** Deep clones a permission map ensuring array isolation. */
export function clonePermissionMap(
  map?: PermissionMap | ReadonlyPermissionMap | null,
): PermissionMap {
  if (!map) return {};
  const cloned: PermissionMap = {};
  for (const [module, actions] of Object.entries(map)) {
    cloned[module] = Array.isArray(actions) ? [...actions] : [];
  }
  return cloned;
}

/** Merges an override permission map over a base permission map. */
export function mergePermissionMaps(
  base: PermissionMap | ReadonlyPermissionMap,
  overrides?: PermissionMap | ReadonlyPermissionMap | null,
): PermissionMap {
  const result = clonePermissionMap(base);
  if (!overrides) return result;
  for (const [module, actions] of Object.entries(overrides)) {
    result[module] = Array.isArray(actions) ? [...actions] : [];
  }
  return result;
}

/**
 * Additive union of permission maps: per module, union of actions
 * in {@link PERMISSION_ACTIONS} order.
 */
export function unionPermissionMaps(
  maps: readonly (PermissionMap | ReadonlyPermissionMap | null | undefined)[],
): PermissionMap {
  const result: PermissionMap = {};
  for (const map of maps) {
    if (!map) continue;
    for (const [module, actions] of Object.entries(map)) {
      if (!Array.isArray(actions) || actions.length === 0) continue;
      const set = new Set<PermissionAction>([
        ...(result[module] ?? []),
        ...actions.filter((a): a is PermissionAction =>
          (PERMISSION_ACTIONS as readonly string[]).includes(a),
        ),
      ]);
      result[module] = PERMISSION_ACTIONS.filter((a) => set.has(a));
    }
  }
  return result;
}

/** Returns the total count of granted actions across all modules in a permission map. */
export function countGrantedActions(map?: PermissionMap | ReadonlyPermissionMap | null): number {
  if (!map) return 0;
  return Object.values(map).reduce(
    (total, actions) => total + (Array.isArray(actions) ? actions.length : 0),
    0,
  );
}

/** Returns true if the map grants all 4 permissions across all specified modules. */
export function isFullPermissionMap(
  map?: PermissionMap | ReadonlyPermissionMap | null,
  moduleIds: readonly (string | RbacModuleId)[] = ALL_RBAC_MODULE_IDS,
): boolean {
  if (!map) return false;
  return moduleIds.every((mod) => {
    const actions = map[mod];
    return (
      Array.isArray(actions) &&
      actions.length >= 4 &&
      PERMISSION_ACTIONS.every((act) => actions.includes(act))
    );
  });
}

/** Returns true if the map has zero granted actions across all modules. */
export function isEmptyPermissionMap(map?: PermissionMap | ReadonlyPermissionMap | null): boolean {
  return countGrantedActions(map) === 0;
}

/** Computes added and removed permission actions between two permission maps. */
export function diffPermissionMaps(
  before: PermissionMap | ReadonlyPermissionMap,
  after: PermissionMap | ReadonlyPermissionMap,
): { added: PermissionMap; removed: PermissionMap } {
  const added: PermissionMap = {};
  const removed: PermissionMap = {};
  const allModules = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const mod of allModules) {
    const beforeActions = before[mod] ?? [];
    const afterActions = after[mod] ?? [];

    const beforeSet = new Set(beforeActions);
    const afterSet = new Set(afterActions);

    const newlyAdded = afterActions.filter((a) => !beforeSet.has(a));
    const newlyRemoved = beforeActions.filter((a) => !afterSet.has(a));

    if (newlyAdded.length > 0) added[mod] = newlyAdded;
    if (newlyRemoved.length > 0) removed[mod] = newlyRemoved;
  }

  return { added, removed };
}

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

export const USER_STATUSES: readonly UserStatus[] = ["active", "inactive", "suspended"] as const;

export const USER_STATUS_REGISTRY: readonly {
  id: UserStatus;
  labelKey: AppTranslationKey;
  badgeVariant: UserBadgeVariant;
}[] = [
  { id: "active", labelKey: "users.status.active", badgeVariant: "success" },
  { id: "inactive", labelKey: "users.status.inactive", badgeVariant: "muted" },
  { id: "suspended", labelKey: "users.status.suspended", badgeVariant: "destructive" },
] as const;

export const USER_STATUS_MAP: Readonly<Record<UserStatus, (typeof USER_STATUS_REGISTRY)[number]>> =
  Object.freeze(
    Object.fromEntries(USER_STATUS_REGISTRY.map((status) => [status.id, status])) as Record<
      UserStatus,
      (typeof USER_STATUS_REGISTRY)[number]
    >,
  );

export function isValidUserStatus(status: unknown): status is UserStatus {
  return (
    typeof status === "string" && Object.prototype.hasOwnProperty.call(USER_STATUS_MAP, status)
  );
}

export const ACTIVITY_ACTIONS: readonly ActivityAction[] = [
  "login",
  "login_failed",
  "create",
  "update",
  "delete",
  "role_change",
] as const;

export const ACTIVITY_ACTION_REGISTRY: readonly {
  id: ActivityAction;
  labelKey: AppTranslationKey;
  badgeVariant: UserBadgeVariant;
}[] = [
  { id: "login", labelKey: "users.action.login", badgeVariant: "success" },
  { id: "login_failed", labelKey: "users.action.loginFailed", badgeVariant: "destructive" },
  { id: "create", labelKey: "users.action.create", badgeVariant: "primary" },
  { id: "update", labelKey: "users.action.update", badgeVariant: "warning" },
  { id: "delete", labelKey: "users.action.delete", badgeVariant: "destructive" },
  { id: "role_change", labelKey: "users.action.roleChange", badgeVariant: "primary" },
] as const;

export const ACTIVITY_ACTION_MAP: Readonly<
  Record<ActivityAction, (typeof ACTIVITY_ACTION_REGISTRY)[number]>
> = Object.freeze(
  Object.fromEntries(ACTIVITY_ACTION_REGISTRY.map((action) => [action.id, action])) as Record<
    ActivityAction,
    (typeof ACTIVITY_ACTION_REGISTRY)[number]
  >,
);

export function isValidActivityAction(action: unknown): action is ActivityAction {
  return (
    typeof action === "string" && Object.prototype.hasOwnProperty.call(ACTIVITY_ACTION_MAP, action)
  );
}

/** Type guard verifying if a value matches the PermissionMap structure. */
export function isPermissionMap(value: unknown): value is PermissionMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const validActions = new Set<string>(PERMISSION_ACTIONS);
  return Object.values(value).every(
    (actions) =>
      Array.isArray(actions) && actions.every((a) => typeof a === "string" && validActions.has(a)),
  );
}
