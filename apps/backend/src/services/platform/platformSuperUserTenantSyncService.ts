import { and, eq, or } from "drizzle-orm";
import type { StoredPlatformUser } from "@mms/shared";
import { withTenant } from "../../db/tenant-context.js";
import { tenantUsers } from "../../db/schema.js";
import { findPlatformUserRowByRole } from "../../db/repositories/platformUserRepository.js";
import { listWorkspaceRows } from "../../db/repositories/workspaceRepository.js";
import { insertPlatformActivityLog } from "../../db/repositories/platformActivityLogsRepository.js";

/**
 * SECURITY NOTE: syncing the platform super-user into every tenant replicates the
 * super-user's scrypt password hash into each tenant's `tenant_users` table and
 * grants `super_admin` access in every workspace. This is intentional (single
 * sign-on / break-glass across tenants), but a single tenant DB compromise exposes
 * the platform super-user's hash and the account can sign into every tenant.
 *
 * Default remains enabled (`PLATFORM_SYNC_SUPERUSER_TO_TENANTS` unset or not
 * `false`) so existing break-glass keeps working. Production deployments that do
 * not need mirrored tenant super-admins MUST set
 * `PLATFORM_SYNC_SUPERUSER_TO_TENANTS=false` and keep tenant DBs strongly isolated.
 * A compromised tenant DB exposes the platform super-user hash and the mirrored
 * account can authenticate into every workspace.
 */
function isSuperUserTenantSyncEnabled(): boolean {
  return process.env.PLATFORM_SYNC_SUPERUSER_TO_TENANTS !== "false";
}

/**
 * Resolves the primary active platform super-user record.
 */
export async function findActivePlatformSuperUser(): Promise<StoredPlatformUser | null> {
  try {
    return await findPlatformUserRowByRole("super_user");
  } catch {
    return null;
  }
}

/**
 * Synchronizes the platform super-user into a specific tenant workspace's `tenant_users` table.
 * Grants `role: 'super_admin'`, verified email, active status, un-deleted state, and matching credentials.
 */
export async function syncPlatformSuperUserToTenant(
  workspaceSubdomain: string,
  explicitSuperUser?: StoredPlatformUser | null,
): Promise<boolean> {
  if (!isSuperUserTenantSyncEnabled()) return false;

  const subdomain = workspaceSubdomain.trim().toLowerCase();
  if (!subdomain) return false;

  const superUser =
    explicitSuperUser !== undefined ? explicitSuperUser : await findActivePlatformSuperUser();

  if (!superUser) return false;

  const normalizedEmail = superUser.email.trim().toLowerCase();
  const superUserId = `pu_${subdomain}_${superUser.id}`;

  const synced = await withTenant(subdomain, async (tx) => {
    const existingRows = await tx
      .select({
        id: tenantUsers.id,
        name: tenantUsers.name,
        passwordHash: tenantUsers.passwordHash,
        emailVerifiedAt: tenantUsers.emailVerifiedAt,
      })
      .from(tenantUsers)
      .where(
        and(
          eq(tenantUsers.workspaceSubdomain, subdomain),
          or(eq(tenantUsers.loginEmail, normalizedEmail), eq(tenantUsers.id, superUserId)),
        ),
      );

    const existing = existingRows[0];

    if (existing) {
      await tx
        .update(tenantUsers)
        .set({
          loginEmail: normalizedEmail,
          name: superUser.name || existing.name,
          passwordHash: superUser.passwordHash || existing.passwordHash,
          role: "super_admin",
          emailVerifiedAt: superUser.emailVerifiedAt
            ? new Date(superUser.emailVerifiedAt)
            : (existing.emailVerifiedAt ?? new Date()),
          mustChangePassword: false,
          deletedAt: null,
          deletedBy: null,
          updatedAt: new Date(),
        })
        .where(and(eq(tenantUsers.workspaceSubdomain, subdomain), eq(tenantUsers.id, existing.id)));
      return true;
    }

    await tx.insert(tenantUsers).values({
      id: superUserId,
      workspaceSubdomain: subdomain,
      loginEmail: normalizedEmail,
      name: superUser.name,
      passwordHash: superUser.passwordHash,
      role: "super_admin",
      emailVerifiedAt: superUser.emailVerifiedAt ? new Date(superUser.emailVerifiedAt) : new Date(),
      mustChangePassword: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      deletedBy: null,
      profileJson: { status: "active" },
    });

    return true;
  });

  if (synced) {
    await insertPlatformActivityLog({
      userId: superUser.id,
      userEmail: superUser.email,
      action: "sync_super_user_to_tenant",
      targetResource: "workspace",
      targetId: subdomain,
      metadataMessage: "Mirrored platform super_user into tenant_users as super_admin",
    });
  }

  return synced;
}

/**
 * Synchronizes the platform super-user to all active and existing workspaces.
 */
export async function syncPlatformSuperUserToTenants(
  explicitSuperUser?: StoredPlatformUser | null,
): Promise<number> {
  const superUser =
    explicitSuperUser !== undefined ? explicitSuperUser : await findActivePlatformSuperUser();

  if (!superUser) return 0;

  const workspaces = await listWorkspaceRows();
  let synced = 0;

  for (const ws of workspaces) {
    const ok = await syncPlatformSuperUserToTenant(ws.subdomain, superUser);
    if (ok) synced++;
  }

  return synced;
}
