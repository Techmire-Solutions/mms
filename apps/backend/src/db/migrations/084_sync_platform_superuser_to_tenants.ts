import { syncPlatformSuperUserToTenants } from "../../services/platform/platformSuperUserTenantSyncService.js";

/**
 * Migration 084: Synchronizes the platform super-user record into the `tenant_users` table
 * for all registered workspaces with role `super_admin`.
 */
export async function runMigration084(): Promise<void> {
  const syncedCount = await syncPlatformSuperUserToTenants();
  console.log(
    `[Migration 084] Synchronized platform super-user to ${syncedCount} tenant workspace(s).`,
  );
}
