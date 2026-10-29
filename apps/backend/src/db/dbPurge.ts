import { WORKSPACES_COLLECTION } from "@mms/shared";
import { like, sql } from "drizzle-orm";
import { getRequestTenant, getRequestUserId } from "../lib/tenantContext.js";
import { deleteAuthArtifactsForWorkspace } from "../services/auth/authArtifactService.js";
import { recordModernAuditEvent } from "../services/auditTrailService.js";
import { type AppDb, withTenant } from "./tenant-context.js";
import { getQueryRows, saveCollection, saveObject } from "./documentStore.js";
import { deleteStoragePrefix } from "../config/storage.js";
import { logger } from "../lib/logger.js";
import { getMinimalCollectionsForSeed, getMinimalObjects } from "./minimalSeeds.js";
import * as schema from "./schema.js";

async function deleteTenantRowsByColumn(
  tx: AppDb,
  columnName: "workspace_subdomain" | "tenant_id",
  tenant: string,
): Promise<void> {
  // `include_deleted` is required so the soft-delete RLS policy does not hide
  // archived rows; without it a workspace purge silently leaves all trashed
  // records behind. `allow_hard_purge` bypasses the BEFORE DELETE trigger.
  await tx.execute(sql`
    SELECT
      set_config('app.include_deleted', 'true', true),
      set_config('app.allow_hard_purge', 'true', true)
  `);
  if (columnName === "workspace_subdomain") {
    await tx.execute(
      sql`UPDATE "faculty_departments" SET "parent_id" = NULL WHERE "workspace_subdomain" = ${tenant}`,
    );
    await tx.execute(
      sql`UPDATE "tasks" SET "parent_task_id" = NULL WHERE "workspace_subdomain" = ${tenant}`,
    );
  }
  const result = await tx.execute(sql`
    SELECT table_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = ${columnName}
    ORDER BY
      CASE
        WHEN table_name = 'contacts' THEN 6
        WHEN table_name IN ('accounting_accounts', 'accounting_fiscal_years') THEN 5
        WHEN table_name IN ('faculty_departments', 'faculty_designations', 'tenant_users') THEN 4
        WHEN table_name IN ('faculty', 'finance_invoices') THEN 3
        WHEN table_name IN ('sessions', 'questions', 'tests', 'finance_payments') THEN 2
        WHEN table_name IN ('faculty_assignments', 'task_assignees', 'finance_payment_allocations', 'finance_invoice_lines', 'finance_credit_notes') THEN 1
        ELSE 0
      END ASC,
      table_name ASC
  `);
  const rows = getQueryRows<{ table_name: string }>(result);

  for (const row of rows) {
    await tx.execute(sql`
      DELETE FROM ${sql.raw(`"${row.table_name.replaceAll('"', '""')}"`)}
      WHERE ${sql.raw(`"${columnName}"`)} = ${tenant}
    `);
  }
}

async function purgeInTransaction(tx: AppDb, tenant: string): Promise<void> {
  const prefix = `t:${tenant}:`;
  await tx.delete(schema.collections).where(like(schema.collections.name, `${prefix}%`));
  await tx.delete(schema.objects).where(like(schema.objects.key, `${prefix}%`));
  await deleteTenantRowsByColumn(tx, "tenant_id", tenant);
  await deleteTenantRowsByColumn(tx, "workspace_subdomain", tenant);
  await deleteAuthArtifactsForWorkspace(tenant);
}

/**
 * Deletes all database rows scoped to a workspace subdomain.
 * Does not modify the global workspaces registry; platform deletion removes that separately.
 * Pass `{ tx }` to join an existing transaction (workspace reset).
 */
export async function purgeTenantDataBySubdomain(
  subdomain: string,
  options?: { tx?: AppDb },
): Promise<void> {
  const tenant = subdomain.trim().toLowerCase();
  if (!tenant) {
    throw new Error("Subdomain is required to purge tenant data");
  }
  if (options?.tx) {
    await purgeInTransaction(options.tx, tenant);
    await deleteTenantExportBlobs(tenant);
    return;
  }
  await withTenant(tenant, (tx) => purgeInTransaction(tx, tenant));
  await deleteTenantExportBlobs(tenant);
}

/** Export blobs live outside the DB and would outlive a purged workspace otherwise. */
async function deleteTenantExportBlobs(tenant: string): Promise<void> {
  await deleteStoragePrefix(`tenants/${tenant}/exports/`).catch((error: unknown) => {
    logger.warn({ tenant, err: error }, "Failed to delete tenant export blobs");
  });
}

/**
 * Resets only the current tenant's data and reseeds minimal defaults, atomically:
 * a failure at any point rolls the purge and the reseed back together.
 */
export async function resetTenantData(): Promise<void> {
  const tenant = getRequestTenant();
  if (!tenant) {
    throw new Error("Tenant context is required to reset workspace data");
  }
  const normalized = tenant.trim().toLowerCase();

  await withTenant(normalized, async (tx) => {
    await purgeInTransaction(tx, normalized);

    const collections = await getMinimalCollectionsForSeed();
    for (const [name, collectionItems] of Object.entries(collections)) {
      if (name === WORKSPACES_COLLECTION) continue;
      await saveCollection(name, collectionItems as unknown[]);
    }
    for (const [key, objectValue] of Object.entries(getMinimalObjects())) {
      await saveObject(key, objectValue);
    }

    await recordModernAuditEvent({
      workspaceSubdomain: normalized,
      tableName: "workspace",
      recordId: normalized,
      actionType: "DELETE",
      realUserId: getRequestUserId() ?? "system",
      newState: { summary: "Workspace reset to minimal defaults", action: "reset" },
    });
  });
}
