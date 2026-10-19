/**
 * Reset all data across all modules while preserving contacts and platform console.
 * Applies to all workspaces/tenants in the local database.
 *
 * Usage:
 *   pnpm --filter mms-backend exec tsx src/scripts/resetAllModulesExceptContacts.ts             (DRY RUN)
 *   pnpm --filter mms-backend exec tsx src/scripts/resetAllModulesExceptContacts.ts --execute   (MUTATE)
 */
import { loadBackendEnv } from "../config/loadEnv.js";
import { closeDatabase, getPool, initDb } from "../db/database.js";
import {
  PRESERVED_CONTACT_COLLECTIONS,
  PRESERVED_CONTACT_OBJECTS,
} from "./resetAllModulesTables.js";
import {
  computeTopologicalDeleteOrder,
  countTenantTableRows,
} from "./resetAllModulesTopological.js";
import {
  cleanupOrphanedCollectionsAndObjects,
  executeTenantResetTx,
} from "./resetAllModulesExecution.js";
import { verifyPostReset } from "./resetAllModulesVerify.js";

loadBackendEnv();

async function main() {
  const isExecute = process.argv.includes("--execute");
  console.log(`\n======================================================`);
  console.log(`RESET ALL MODULES DATA (KEEP CONTACTS & PLATFORM)`);
  console.log(`Mode: ${isExecute ? "EXECUTE (HARD RESET)" : "DRY-RUN (PREVIEW ONLY)"}`);
  console.log(`======================================================\n`);

  await initDb();
  const pool = getPool();

  // 1. List all active tenant workspaces
  const wsRes = await pool.query<{ subdomain: string; madrasa_name: string }>(
    `SELECT subdomain, madrasa_name FROM workspaces ORDER BY subdomain`,
  );
  const activeTenants = wsRes.rows.map((r) => r.subdomain.toLowerCase());
  console.log(`Active Workspaces (${activeTenants.length}):`);
  for (const r of wsRes.rows) {
    console.log(` - [${r.subdomain}] ${r.madrasa_name}`);
  }

  // 2. Compute delete order
  const deleteOrder = await computeTopologicalDeleteOrder(pool);
  console.log(`\nIdentified ${deleteOrder.length} module tables eligible for reset.`);

  // 3. Collect statistics and execute per tenant
  let grandTotalDeleted = 0;

  for (const tenant of activeTenants) {
    console.log(`\n--- Tenant: ${tenant} ---`);

    // Protected baseline counts
    const contactsCount = await countTenantTableRows(
      pool,
      "contacts",
      "workspace_subdomain",
      tenant,
    );
    const phonesCount = await countTenantTableRows(
      pool,
      "contact_phones",
      "workspace_subdomain",
      tenant,
    );
    const emailsCount = await countTenantTableRows(
      pool,
      "contact_emails",
      "workspace_subdomain",
      tenant,
    );
    const addressesCount = await countTenantTableRows(
      pool,
      "contact_addresses",
      "workspace_subdomain",
      tenant,
    );
    const usersCount = await countTenantTableRows(
      pool,
      "tenant_users",
      "workspace_subdomain",
      tenant,
    );

    console.log(`Protected records:`);
    console.log(`  contacts: ${contactsCount}`);
    console.log(`  contact_phones: ${phonesCount}`);
    console.log(`  contact_emails: ${emailsCount}`);
    console.log(`  contact_addresses: ${addressesCount}`);
    console.log(`  tenant_users: ${usersCount}`);

    // Count rows to delete in module tables
    const tablesToDeleteFrom: Array<{ table: string; column: string; count: number }> = [];
    for (const item of deleteOrder) {
      const count = await countTenantTableRows(pool, item.table, item.column, tenant);
      if (count > 0) {
        tablesToDeleteFrom.push({ table: item.table, column: item.column, count });
      }
    }

    // Count doc store collections and objects to delete
    const colRes = await pool.query<{ name: string }>(
      `SELECT name FROM collections WHERE name LIKE $1`,
      [`t:${tenant}:%`],
    );
    const tenantColsToDelete = colRes.rows.filter(
      (r) => !PRESERVED_CONTACT_COLLECTIONS.has(r.name.replace(`t:${tenant}:`, "")),
    );

    const objRes = await pool.query<{ key: string }>(`SELECT key FROM objects WHERE key LIKE $1`, [
      `t:${tenant}:%`,
    ]);
    const tenantObjsToDelete = objRes.rows.filter(
      (r) => !PRESERVED_CONTACT_OBJECTS.has(r.key.replace(`t:${tenant}:`, "")),
    );

    console.log(`\nModule rows to delete:`);
    let tenantRowsTotal = 0;
    for (const t of tablesToDeleteFrom) {
      console.log(`  ${t.table}: ${t.count}`);
      tenantRowsTotal += t.count;
    }
    console.log(`  docstore collections: ${tenantColsToDelete.length}`);
    console.log(`  docstore objects: ${tenantObjsToDelete.length}`);
    console.log(
      `Tenant total module records: ${tenantRowsTotal + tenantColsToDelete.length + tenantObjsToDelete.length}`,
    );

    grandTotalDeleted += tenantRowsTotal + tenantColsToDelete.length + tenantObjsToDelete.length;

    if (isExecute) {
      await executeTenantResetTx(tenant, deleteOrder, tenantColsToDelete, tenantObjsToDelete);
    }
  }

  // 4. Orphaned and legacy collections/objects cleanup
  await cleanupOrphanedCollectionsAndObjects(pool, activeTenants, isExecute);

  // 5. Verification step
  if (isExecute) {
    await verifyPostReset(pool, activeTenants, deleteOrder);
  } else {
    console.log(
      `\nDry run complete. Found ${grandTotalDeleted} rows/keys to reset across module tables.`,
    );
    console.log(`To execute the hard reset, run with --execute.`);
  }

  await closeDatabase();
  process.exit(0);
}

main().catch(async (err) => {
  console.error("\n❌ Reset failed:", err);
  try {
    await closeDatabase();
  } catch {
    // ignore database close failure on exit
  }
  process.exit(1);
});
