import { inArray, sql } from "drizzle-orm";
import type pg from "pg";
import { withTenant } from "../db/tenant-context.js";
import { collections, objects } from "../db/schema.js";
import { quoteIdent, SELF_REFERENCING_FKS } from "./resetAllModulesTables.js";

export async function executeTenantResetTx(
  tenant: string,
  deleteOrder: Array<{ table: string; column: string }>,
  tenantColsToDelete: Array<{ name: string }>,
  tenantObjsToDelete: Array<{ key: string }>,
): Promise<void> {
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

export async function cleanupOrphanedCollectionsAndObjects(
  pool: pg.Pool,
  activeTenants: string[],
  isExecute: boolean,
): Promise<void> {
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
}
