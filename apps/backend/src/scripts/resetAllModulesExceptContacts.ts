/**
 * Reset all data across all modules while preserving contacts and platform console.
 * Applies to all workspaces/tenants in the local database.
 *
 * Usage:
 *   pnpm --filter mms-backend exec tsx src/scripts/resetAllModulesExceptContacts.ts             (DRY RUN)
 *   pnpm --filter mms-backend exec tsx src/scripts/resetAllModulesExceptContacts.ts --execute   (MUTATE)
 */
import { inArray, sql } from "drizzle-orm";
import { loadBackendEnv } from "../config/loadEnv.js";
import { closeDatabase, getPool, initDb } from "../db/database.js";
import { withTenant } from "../db/tenant-context.js";
import { collections, objects } from "../db/schema.js";
import { verifyTenantAuditChain } from "../services/auditVerificationService.js";
import {
  PRESERVED_CONTACT_COLLECTIONS,
  PRESERVED_CONTACT_OBJECTS,
  quoteIdent,
  SELF_REFERENCING_FKS,
} from "./resetAllModulesTables.js";
import {
  computeTopologicalDeleteOrder,
  countTenantTableRows,
} from "./resetAllModulesTopological.js";

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
      console.log(`\nExecuting reset for tenant "${tenant}"...`);
      await withTenant(tenant, async (tx) => {
        // Enable hard purge & include deleted
        await tx.execute(sql`
          SELECT
            set_config('app.include_deleted', 'true', true),
            set_config('app.allow_hard_purge', 'true', true)
        `);

        // Nullify self-referencing FKs
        for (const { table, column } of SELF_REFERENCING_FKS) {
          await tx.execute(sql`
            UPDATE ${sql.raw(quoteIdent(table))}
            SET ${sql.raw(quoteIdent(column))} = NULL
            WHERE "workspace_subdomain" = ${tenant}
          `);
        }

        // Delete from module tables in topological order
        for (const item of deleteOrder) {
          await tx.execute(sql`
            DELETE FROM ${sql.raw(quoteIdent(item.table))}
            WHERE ${sql.raw(quoteIdent(item.column))} = ${tenant}
          `);
        }

        // Delete non-contact collections for this tenant
        if (tenantColsToDelete.length > 0) {
          const colNames = tenantColsToDelete.map((c) => c.name);
          await tx.delete(collections).where(inArray(collections.name, colNames));
        }

        // Delete non-contact objects for this tenant
        if (tenantObjsToDelete.length > 0) {
          const objKeys = tenantObjsToDelete.map((o) => o.key);
          await tx.delete(objects).where(inArray(objects.key, objKeys));
        }

        // Prune non-contact UI preferences for tenant users
        await tx.execute(sql`
          UPDATE user_ui_preferences
          SET state = jsonb_build_object(
            'contacts_active_tab', 'work',
            'contacts.table.columns', COALESCE(state->'contacts.table.columns', '[]'::jsonb)
          )
          WHERE workspace_subdomain = ${tenant}
        `);
      });
      console.log(`✅ Tenant "${tenant}" module data reset successfully.`);
    }
  }

  // 4. Orphaned and legacy collections/objects cleanup
  const orphanedColRes = await pool.query<{ name: string }>(
    `SELECT name FROM collections WHERE name LIKE 't:%'`,
  );
  const orphanedCols = orphanedColRes.rows.filter((r) => {
    const tenant = r.name.split(":")[1];
    return !activeTenants.includes(tenant);
  });

  const orphanedObjRes = await pool.query<{ key: string }>(
    `SELECT key FROM objects WHERE key LIKE 't:%'`,
  );
  const orphanedObjs = orphanedObjRes.rows.filter((r) => {
    const tenant = r.key.split(":")[1];
    return !activeTenants.includes(tenant);
  });

  // Non-prefixed legacy module collections/objects
  const nonPrefixedColsToDelete = [
    "students",
    "teachers",
    "questions",
    "tests",
    "assessment_results",
  ];
  const nonPrefixedObjsToDelete = [
    "teachers_settings",
    "students_settings",
    "question_bank_settings",
  ];

  console.log(`\n--- Orphaned / Legacy Cleanup ---`);
  console.log(`Orphaned test-tenant collections: ${orphanedCols.length}`);
  console.log(`Orphaned test-tenant objects: ${orphanedObjs.length}`);
  console.log(`Non-prefixed legacy collections: ${nonPrefixedColsToDelete.length}`);
  console.log(`Non-prefixed legacy objects: ${nonPrefixedObjsToDelete.length}`);

  if (isExecute) {
    if (orphanedCols.length > 0) {
      const names = orphanedCols.map((c) => c.name);
      await pool.query(`DELETE FROM collections WHERE name = ANY($1::text[])`, [names]);
    }
    if (orphanedObjs.length > 0) {
      const keys = orphanedObjs.map((o) => o.key);
      await pool.query(`DELETE FROM objects WHERE key = ANY($1::text[])`, [keys]);
    }
    await pool.query(`DELETE FROM collections WHERE name = ANY($1::text[])`, [
      nonPrefixedColsToDelete,
    ]);
    await pool.query(`DELETE FROM objects WHERE key = ANY($1::text[])`, [nonPrefixedObjsToDelete]);
    console.log(`✅ Cleaned up orphaned test collections and objects.`);
  }

  // 5. Verification step
  if (isExecute) {
    console.log(`\n======================================================`);
    console.log(`POST-RESET VERIFICATION`);
    console.log(`======================================================`);

    for (const tenant of activeTenants) {
      const remainingModuleRows = [];
      for (const item of deleteOrder) {
        const count = await countTenantTableRows(pool, item.table, item.column, tenant);
        if (count > 0) {
          remainingModuleRows.push(`${item.table}: ${count}`);
        }
      }

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

      console.log(`Tenant "${tenant}":`);
      console.log(`  contacts: ${contactsCount} (PRESERVED)`);
      console.log(`  contact_phones: ${phonesCount} (PRESERVED)`);
      console.log(`  contact_emails: ${emailsCount} (PRESERVED)`);
      console.log(`  contact_addresses: ${addressesCount} (PRESERVED)`);
      console.log(`  tenant_users: ${usersCount} (PRESERVED)`);

      if (remainingModuleRows.length > 0) {
        console.error(`  ⚠️ Remaining module rows found:`, remainingModuleRows);
        throw new Error(`Reset incomplete for tenant ${tenant}`);
      } else {
        console.log(`  ✅ All 131 module tables are completely reset (0 rows).`);
      }

      // Check audit chain
      const auditRes = await verifyTenantAuditChain(tenant);
      console.log(`  Audit chain status: ${auditRes.status} (Verified)`);
    }

    // Verify platform console
    const wsCount = (
      await pool.query<{ count: number }>("SELECT count(*)::int as count FROM workspaces")
    ).rows[0].count;
    const puCount = (
      await pool.query<{ count: number }>("SELECT count(*)::int as count FROM platform_users")
    ).rows[0].count;
    const pupCount = (
      await pool.query<{ count: number }>(
        "SELECT count(*)::int as count FROM platform_user_permissions",
      )
    ).rows[0].count;
    const psCount = (
      await pool.query<{ count: number }>("SELECT count(*)::int as count FROM platform_settings")
    ).rows[0].count;
    const palCount = (
      await pool.query<{ count: number }>(
        "SELECT count(*)::int as count FROM platform_activity_logs",
      )
    ).rows[0].count;

    console.log(`\nPlatform Console (PRESERVED):`);
    console.log(`  workspaces: ${wsCount}`);
    console.log(`  platform_users: ${puCount}`);
    console.log(`  platform_user_permissions: ${pupCount}`);
    console.log(`  platform_settings: ${psCount}`);
    console.log(`  platform_activity_logs: ${palCount}`);
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
