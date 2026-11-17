import {
  USERS_MODULE_MANIFEST,
  canAccessRolesAndPermissions,
  normalizeWorkspaceRoles,
  type User,
} from "@mms/shared";
import { userHasPermission } from "../../../lib/userPermissionContext.js";
import { loadUserModulePreferences } from "../../../services/userPreferencesService.js";

/**
 * Authorizes a users-preferences write. The roles/permissions catalog is
 * privilege-granting, so it may only change for admin/super_admin actors;
 * non-admins holding `settings.global.write` may still save the registration
 * policy fields as long as they do not alter `workspaceRoles`.
 */
export async function canWriteUserPreferences(user: User, body: unknown): Promise<boolean> {
  if (!userHasPermission(user, USERS_MODULE_MANIFEST.permissions.setupWrite)) return false;
  const roles = (body as { workspaceRoles?: unknown } | undefined)?.workspaceRoles;
  if (roles === undefined) return true;
  if (canAccessRolesAndPermissions(user.role)) return true;
  const existing = await loadUserModulePreferences();
  const incoming = normalizeWorkspaceRoles(roles) ?? [];
  const current = existing?.workspaceRoles ?? [];
  return JSON.stringify(incoming) === JSON.stringify(current);
}
