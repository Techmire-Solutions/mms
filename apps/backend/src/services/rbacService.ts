/** Tenant RBAC collection/object permission maps and can* helpers. */
export * from "../lib/rbacPermissionMaps.js";
export * from "../lib/rbacCanHelpers.js";

import { getOrSetMultiTier, invalidateMultiTierCache } from "../lib/cache/index.js";

export interface TenantRoleMatrix {
  [userId: string]: { role: string; deletedAt: string | null };
}

/**
 * Loads and caches the entire tenant role matrix.
 * Used for ultra-fast L1/L2 evaluation of user status and role assignments without hitting the DB.
 */
export async function getTenantRoleMatrix(tenantId: string): Promise<TenantRoleMatrix> {
  return getOrSetMultiTier(
    tenantId,
    "rbac",
    "matrix",
    async () => {
      const { listAllTenantUsersByWorkspace } =
        await import("../db/repositories/tenantUserRepositoryHydrate.js");
      const users = await listAllTenantUsersByWorkspace(tenantId);
      const matrix: TenantRoleMatrix = {};
      for (const u of users) {
        matrix[u.id] = { role: u.role ?? "user", deletedAt: u.deletedAt ?? null };
      }
      return matrix;
    },
    { ttlSeconds: 3600 },
  );
}

/**
 * Invalidates every cached RBAC entry for a tenant: the role matrix and the
 * tenant role catalog. Called when a user's role is updated or soft-deleted,
 * and when the workspace role catalog is edited.
 */
export async function invalidateTenantRbac(tenantId: string): Promise<void> {
  // Domain-wide (no key): evicts matrix + catalog from L1/L2 and broadcasts.
  await invalidateMultiTierCache({ tenantId, domain: "rbac" });
}
