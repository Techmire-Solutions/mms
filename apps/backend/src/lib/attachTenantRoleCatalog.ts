/**
 * @file attachTenantRoleCatalog.ts
 * @description Attaches the workspace role catalog to an authenticated user.
 *
 * System roles use the built-in map and skip the lookup entirely. Custom and
 * faculty composite roles need the tenant catalog, which is cached per tenant.
 */
import { isSystemRole, type User } from "@mms/shared";

export async function attachTenantRoleCatalog(user: User, tenant: string): Promise<void> {
  if (!user.role || isSystemRole(user.role)) return;

  const [{ getTenantRoleCatalog }, { setUserRoleCatalog }] = await Promise.all([
    import("./tenantRoleCatalog.js"),
    import("./userPermissionContext.js"),
  ]);
  setUserRoleCatalog(user, await getTenantRoleCatalog(tenant));
}
