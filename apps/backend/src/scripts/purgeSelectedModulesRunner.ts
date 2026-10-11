import { inArray, sql } from "drizzle-orm";
import { withTenant } from "../db/tenant-context.js";
import { getQueryRows } from "../db/documentStoreKeys.js";
import * as schema from "../db/schema.js";
import {
  PURGE_DOCUMENT_STORE_SUFFIXES,
  PURGE_MODULE_TABLES,
  PURGE_SELF_FK_NULLS,
  assertPurgeAllowlistSafe,
  quoteIdent,
} from "./purgeSelectedModulesAllowlist.js";

export type TableCount = { table: string; count: number };
export type TenantPurgeReport = {
  subdomain: string;
  tables: TableCount[];
  documentStoreKeys: number;
};

function docStoreKeysForTenant(tenant: string): string[] {
  const prefix = `t:${tenant}:`;
  return PURGE_DOCUMENT_STORE_SUFFIXES.map((suffix) => `${prefix}${suffix}`);
}

async function countTable(tenant: string, table: string): Promise<number> {
  return withTenant(tenant, async (tx) => {
    await tx.execute(sql`
      SELECT
        set_config('app.include_deleted', 'true', true),
        set_config('app.allow_hard_purge', 'true', true)
    `);
    const result = await tx.execute(sql`
      SELECT COUNT(*)::int AS count
      FROM ${sql.raw(quoteIdent(table))}
      WHERE "workspace_subdomain" = ${tenant}
    `);
    const rows = getQueryRows<{ count: number }>(result);
    return Number(rows[0]?.count ?? 0);
  });
}

async function countDocumentStore(tenant: string): Promise<number> {
  const names = docStoreKeysForTenant(tenant);
  return withTenant(tenant, async (tx) => {
    const col = await tx
      .select({ name: schema.collections.name })
      .from(schema.collections)
      .where(inArray(schema.collections.name, names));
    const obj = await tx
      .select({ key: schema.objects.key })
      .from(schema.objects)
      .where(inArray(schema.objects.key, names));
    return col.length + obj.length;
  });
}

export async function listWorkspaceSubdomains(
  query: (sqlText: string) => Promise<{ rows: Array<{ subdomain: string }> }>,
): Promise<string[]> {
  const result = await query(`SELECT subdomain FROM workspaces ORDER BY subdomain ASC`);
  return result.rows.map((row) => String(row.subdomain).trim().toLowerCase()).filter(Boolean);
}

export async function collectTenantReport(tenant: string): Promise<TenantPurgeReport> {
  assertPurgeAllowlistSafe();
  const tables: TableCount[] = [];
  for (const table of PURGE_MODULE_TABLES) {
    tables.push({ table, count: await countTable(tenant, table) });
  }
  return {
    subdomain: tenant,
    tables,
    documentStoreKeys: await countDocumentStore(tenant),
  };
}

export async function purgeTenantSelectedModules(tenant: string): Promise<void> {
  assertPurgeAllowlistSafe();
  const docNames = docStoreKeysForTenant(tenant);

  await withTenant(tenant, async (tx) => {
    await tx.execute(sql`
      SELECT
        set_config('app.include_deleted', 'true', true),
        set_config('app.allow_hard_purge', 'true', true)
    `);

    for (const { table, column } of PURGE_SELF_FK_NULLS) {
      await tx.execute(sql`
        UPDATE ${sql.raw(quoteIdent(table))}
        SET ${sql.raw(quoteIdent(column))} = NULL
        WHERE "workspace_subdomain" = ${tenant}
      `);
    }

    for (const table of PURGE_MODULE_TABLES) {
      await tx.execute(sql`
        DELETE FROM ${sql.raw(quoteIdent(table))}
        WHERE "workspace_subdomain" = ${tenant}
      `);
    }

    await tx.delete(schema.collections).where(inArray(schema.collections.name, docNames));
    await tx.delete(schema.objects).where(inArray(schema.objects.key, docNames));
  });
}
