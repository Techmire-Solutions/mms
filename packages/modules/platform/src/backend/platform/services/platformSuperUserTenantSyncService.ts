import { and, eq, or } from "drizzle-orm";
import type { StoredPlatformUser } from "@mms/contracts";
import { withTenant } from "@mms/db/context";
import { tenantUsers } from "@mms/db/schema";
import { findPlatformUserRowByRole } from "../repository/db/platformUserRepository.js";
import { listWorkspaceRows } from "../deps.js";
import { insertPlatformActivityLog } from "../repository/db/platformActivityLogsRepository.js";

/**
 * SECURITY NOTE: the platform→tenant super-user mirror is OPT-IN
 * (`PLATFORM_SYNC_SUPERUSER_TO_TENANTS=true`). It replays the platform super-user's
 * scrypt password hash into each tenant's `tenant_users` table and grants
 * `super_admin` in every workspace — a single tenant DB compromise then exposes the
 * platform super-user hash and the account can sign into every tenant.
 *
 * The secure default is therefore disabled: no platform user is ever added as any
 * role in a tenant. Workspace provisioning never mirrors the platform user even when
 * this flag is enabled — the admin created during onboarding is the tenant's only
 * super_admin (`workspaceAdminProvisioningService.ts`).
 *
 * Enable the flag only for deployments that explicitly require mirrored
 * break-glass tenant super-admins and keep tenant DBs strongly isolated.
 */
function isSuperUserTenantSyncEnabled(): boolean {
  return process.env.PLATFORM_SYNC_SUPERUSER_TO_TENANTS === "true";
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
