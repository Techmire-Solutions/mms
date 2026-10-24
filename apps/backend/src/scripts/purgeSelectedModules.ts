/**
 * Selective multi-tenant hard purge for listed modules only.
 *
 * Default: dry-run (counts). Mutating run requires --execute.
 *
 * Usage:
 *   pnpm --filter mms-backend purge:selected-modules
 *   pnpm --filter mms-backend purge:selected-modules -- --execute
 */
import { sql } from "drizzle-orm";
import { loadBackendEnv } from "../config/loadEnv.js";
import { closeDatabase, getPool, initDb } from "../db/database.js";
import { withTenant } from "../db/tenant-context.js";
import { getQueryRows } from "../db/documentStoreKeys.js";
import { assertPurgeAllowlistSafe } from "./purgeSelectedModulesAllowlist.js";
import {
  collectTenantReport,
  listWorkspaceSubdomains,
  purgeTenantSelectedModules,
  type TenantPurgeReport,
} from "./purgeSelectedModulesRunner.js";

loadBackendEnv();

function parseExecuteFlag(argv: string[]): boolean {
  return argv.includes("--execute");
}

function printReport(report: TenantPurgeReport): number {
  let total = 0;
  console.log(`\n=== tenant: ${report.subdomain} ===`);
  for (const row of report.tables) {
    if (row.count === 0) continue;
    console.log(`  ${row.table}: ${row.count}`);
    total += row.count;
  }
  if (report.documentStoreKeys > 0) {
    console.log(`  document-store keys: ${report.documentStoreKeys}`);
    total += report.documentStoreKeys;
  }
  if (total === 0) {
    console.log("  (empty)");
  }
  return total;
}

async function countProtected(tenant: string): Promise<{
  contacts: number;
  financeInvoices: number;
  tenantUsers: number;
}> {
  return withTenant(tenant, async (tx) => {
    await tx.execute(sql`SELECT set_config('app.include_deleted', 'true', true)`);
    const contacts = getQueryRows<{ count: number }>(
      await tx.execute(sql`
        SELECT COUNT(*)::int AS count FROM contacts WHERE workspace_subdomain = ${tenant}
      `),
    );
    const finance = getQueryRows<{ count: number }>(
      await tx.execute(sql`
        SELECT COUNT(*)::int AS count FROM finance_invoices WHERE workspace_subdomain = ${tenant}
      `),
    );
    const users = getQueryRows<{ count: number }>(
      await tx.execute(sql`
        SELECT COUNT(*)::int AS count FROM tenant_users WHERE workspace_subdomain = ${tenant}
      `),
    );
    return {
      contacts: Number(contacts[0]?.count ?? 0),
      financeInvoices: Number(finance[0]?.count ?? 0),
      tenantUsers: Number(users[0]?.count ?? 0),
    };
  });
}

async function run(): Promise<void> {
  assertPurgeAllowlistSafe();
  const execute = parseExecuteFlag(process.argv.slice(2));
  await initDb();
  const pool = getPool();

  const tenants = await listWorkspaceSubdomains(async (sqlText) => pool.query(sqlText));
  console.log(
    `Mode: ${execute ? "EXECUTE (hard delete)" : "DRY-RUN (counts only)"}\n` +
      `Workspaces: ${tenants.length}`,
  );

  let grandTotal = 0;
  const protectedBefore: Record<string, number> = {};

  for (const tenant of tenants) {
    if (!execute) {
      const protectedCounts = await countProtected(tenant);
      protectedBefore[`${tenant}:contacts`] = protectedCounts.contacts;
      protectedBefore[`${tenant}:finance_invoices`] = protectedCounts.financeInvoices;
      protectedBefore[`${tenant}:tenant_users`] = protectedCounts.tenantUsers;
    }

    const before = await collectTenantReport(tenant);
    grandTotal += printReport(before);

    if (execute) {
      console.log(`  purging ${tenant}...`);
      await purgeTenantSelectedModules(tenant);
      const after = await collectTenantReport(tenant);
      const remaining =
        after.tables.reduce((sum, row) => sum + row.count, 0) + after.documentStoreKeys;
      if (remaining !== 0) {
        throw new Error(`Tenant ${tenant} still has ${remaining} allowlisted row(s) after purge`);
      }
      console.log("  purged OK");
    }
  }

  if (!execute) {
    console.log("\nProtected module snapshot (must stay unchanged after execute):");
    for (const [key, count] of Object.entries(protectedBefore)) {
      console.log(`  ${key}: ${count}`);
    }
    console.log(`\nDry-run total allowlisted rows/keys: ${grandTotal}`);
    console.log("Re-run with --execute to hard-delete.");
  } else {
    console.log("\nExecute complete. Re-run without --execute to verify zeros.");
  }

  await closeDatabase();
}

run().catch(async (err) => {
  console.error("purgeSelectedModules failed:", err);
  try {
    await closeDatabase();
  } catch {
    // ignore
  }
  process.exit(1);
});
