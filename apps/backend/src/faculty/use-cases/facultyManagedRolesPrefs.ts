/**
 * @file facultyManagedRolesPrefs.ts
 * @description Upsert/remove faculty-managed composite roles in user module preferences.
 */
import {
  DEFAULT_WORKSPACE_ROLES,
  excludeFacultyManagedRoles,
  isFacultyManagedRole,
  normalizeUserModulePreferences,
  preserveFacultyManagedRoles,
  refreshFacultyManagedRolePermissions,
  type UserModulePreferences,
  type WorkspaceRole,
} from "@mms/shared";
import {
  getUserModulePreferencesByWorkspace,
  upsertUserModulePreferences,
} from "../../db/repositories/userModulePreferencesRepository.js";
import { invalidateTenantRbac } from "../../services/rbacService.js";

async function loadPrefs(tenant: string): Promise<UserModulePreferences> {
  const raw = await getUserModulePreferencesByWorkspace(tenant);
  return normalizeUserModulePreferences(raw);
}

function catalogRoles(roles: readonly WorkspaceRole[] | undefined): WorkspaceRole[] {
  const list = roles?.length ? [...roles] : [...DEFAULT_WORKSPACE_ROLES];
  return excludeFacultyManagedRoles(list);
}

async function persistRoles(
  tenant: string,
  prefs: UserModulePreferences,
  roles: WorkspaceRole[],
): Promise<void> {
  await upsertUserModulePreferences(tenant, {
    ...prefs,
    workspaceRoles: roles,
  } as Record<string, unknown>);
  await invalidateTenantRbac(tenant);
}

/** Insert or replace a managed faculty composite role in workspaceRoles. */
export async function upsertFacultyManagedWorkspaceRole(
  tenant: string,
  composite: WorkspaceRole,
): Promise<void> {
  const prefs = await loadPrefs(tenant);
  const current = prefs.workspaceRoles?.length
    ? [...prefs.workspaceRoles]
    : [...DEFAULT_WORKSPACE_ROLES];
  const next = current.filter((r) => r.id !== composite.id);
  next.push(composite);
  await persistRoles(tenant, prefs, next);
}

/** Remove a managed role id when no longer needed. */
export async function removeFacultyManagedWorkspaceRole(
  tenant: string,
  roleId: string,
): Promise<void> {
  if (!isFacultyManagedRole({ id: roleId, managedBy: "faculty_designations" })) return;
  const prefs = await loadPrefs(tenant);
  const current = prefs.workspaceRoles ?? [];
  if (!current.some((r) => r.id === roleId)) return;
  await persistRoles(
    tenant,
    prefs,
    current.filter((r) => r.id !== roleId),
  );
}

/**
 * On Roles Setup save: preserve server-owned managed roles and refresh their
 * permissions from the updated catalog definitions.
 */
export function mergeWorkspaceRolesForPrefsSave(
  incoming: readonly WorkspaceRole[] | undefined,
  existing: readonly WorkspaceRole[] | undefined,
): WorkspaceRole[] {
  const incomingList = incoming?.length ? [...incoming] : [...DEFAULT_WORKSPACE_ROLES];
  const existingList = existing ?? [];
  const preserved = preserveFacultyManagedRoles(incomingList, existingList);
  const catalog = catalogRoles(incomingList);
  return refreshFacultyManagedRolePermissions(preserved, catalog);
}
