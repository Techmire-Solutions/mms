import { loadBackendEnv } from "../config/loadEnv.js";
import { initDb, closeDatabase, getPool } from "../db/database.js";
import { deleteWorkspace, invalidateWorkspaceCache } from "../services/workspaceService.js";
import { syncPlatformSuperUserToTenants } from "../services/platform/platformSuperUserTenantSyncService.js";

loadBackendEnv();

async function run(): Promise<void> {
  await initDb();
  const pool = getPool();

  // Find all workspaces except 'dq' (Dar Ul Quran)
  const res = await pool.query(
    "SELECT subdomain, madrasa_name FROM workspaces WHERE subdomain != 'dq' AND madrasa_name NOT ILIKE '%dar ul quran%'",
  );

  const targets = res.rows;
  console.log(
    `Found ${targets.length} tenant workspace(s) to remove. Preserving 'dq' (Dar Ul Quran)...`,
  );

  let count = 0;
  for (const target of targets) {
    try {
      await deleteWorkspace(target.subdomain);
      await invalidateWorkspaceCache(target.subdomain);
      count++;
      if (count % 25 === 0 || count === targets.length) {
        console.log(`Purged ${count}/${targets.length} workspaces...`);
      }
    } catch (err) {
      console.error(`Error deleting workspace ${target.subdomain}:`, err);
    }
  }

  // Clean up test platform admins so only the super_user remains
  const cleanAdmins = await pool.query(
    "DELETE FROM platform_users WHERE role != 'super_user' AND email != 'syedaalin@gmail.com'",
  );
  console.log(`Cleaned up ${cleanAdmins.rowCount} test platform admin account(s).`);

  // Clean up stale synced test admin records from tenant_users in dq
  const client = await pool.connect();
  try {
    await client.query("BEGIN;");
    await client.query("SELECT set_config('app.allow_hard_purge', 'true', true);");
    await client.query("SELECT set_config('app.rls_bypass', 'on', true);");
    const cleanTenantUsers = await client.query(
      "DELETE FROM tenant_users WHERE workspace_subdomain = 'dq' AND login_email != 'syedaalin@gmail.com'",
    );
    await client.query("COMMIT;");
    console.log(`Cleaned up ${cleanTenantUsers.rowCount} stale synced user(s) from dq tenant.`);
  } catch (e) {
    await client.query("ROLLBACK;");
    throw e;
  } finally {
    client.release();
  }

  // Re-synchronize the platform super-user to Dar Ul Quran
  const synced = await syncPlatformSuperUserToTenants();
  console.log(`Synchronized platform super-user to ${synced} workspace(s).`);

  // Verify remaining workspaces
  const remaining = await pool.query("SELECT id, subdomain, madrasa_name, enabled FROM workspaces");
  console.log("Remaining workspace(s):", remaining.rows);

  await closeDatabase();
  process.exit(0);
}

run().catch((err) => {
  console.error("Failed to clean workspaces:", err);
  process.exit(1);
});
