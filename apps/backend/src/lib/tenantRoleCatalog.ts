/**
 * @file tenantRoleCatalog.ts
 * @description Tenant-authored role catalog for server-side permission checks.
 *
 * Custom roles (including faculty designation-managed composites) live in the
 * workspace `user_module_preferences.workspace_roles` slice. The catalog is
 * cached per tenant under the `rbac` domain and invalidated with the role
 * matrix, so role edits/removals apply on the next request.
 */
import { isSystemRole, roleHasPermission, type Permission, type WorkspaceRole } from "@mms/shared";
import { getOrSetMultiTier } from "./cache/index.js";
import { getTenantUsersSettings } from "../services/users/usersSettingsService.js";
import { resolveCurrentTenantRole } from "./currentTenantRole.js";

const ROLE_CATALOG_TTL_SECONDS = 3600;

/**
 * Custom roles for a tenant. System-role ids are filtered out so a stored
 * custom definition can never shadow the built-in role of the same id.
 */
export async function getTenantRoleCatalog(tenant: string): Promise<readonly WorkspaceRole[]> {
  const subdomain = tenant.trim().toLowerCase();
  if (!subdomain) return [];

  return getOrSetMultiTier(
    subdomain,
    "rbac",
    "catalog",
    async () => {
      const settings = await getTenantUsersSettings(subdomain);
      return (settings.workspaceRoles ?? []).filter((role) => !isSystemRole(role.id));
    },
    { ttlSeconds: ROLE_CATALOG_TTL_SECONDS },
  );
}

/** Permission check for a role id that is not backed by an authenticated user object. */
export async function tenantRoleHasPermission(
  tenant: string,
  role: string | null | undefined,
  permission: Permission,
): Promise<boolean> {
  if (!role) return false;
  const catalog = isSystemRole(role) ? [] : await getTenantRoleCatalog(tenant);
  return roleHasPermission(role, permission, catalog);
}

/**
 * Checks the user's *current* tenant role (matrix) plus the catalog, for
 * background jobs where the queue-time payload may be stale.
 */
export async function tenantUserHasPermission(
  tenant: string,
  userId: string,
  permission: Permission,
): Promise<boolean> {
  const role = await resolveCurrentTenantRole(tenant, userId);
  return tenantRoleHasPermission(tenant, role, permission);
}
