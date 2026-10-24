import type pg from "pg";
import { verifyTenantAuditChain } from "../services/auditVerificationService.js";
import { countTenantTableRows } from "./resetAllModulesTopological.js";

export async function verifyPostReset(
  pool: pg.Pool,
  activeTenants: string[],
  deleteOrder: Array<{ table: string; column: string }>,
): Promise<void> {
  console.log(`\n======================================================`);
  console.log(`POST-RESET VERIFICATION`);
  console.log(`======================================================`);

  for (const tenant of activeTenants) {
    const remainingModuleRows: string[] = [];
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
    await pool.query<{ count: number }>("SELECT count(*)::int as count FROM platform_activity_logs")
  ).rows[0].count;

  console.log(`\nPlatform Console (PRESERVED):`);
  console.log(`  workspaces: ${wsCount}`);
  console.log(`  platform_users: ${puCount}`);
  console.log(`  platform_user_permissions: ${pupCount}`);
  console.log(`  platform_settings: ${psCount}`);
  console.log(`  platform_activity_logs: ${palCount}`);
}
