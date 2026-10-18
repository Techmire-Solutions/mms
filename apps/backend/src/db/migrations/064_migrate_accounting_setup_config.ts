import { eq } from "drizzle-orm";
import { getDb } from "../dbClient.js";
import * as schema from "../schema.js";
import { withGlobalTenant } from "../tenant-context.js";
import {
  normalizeAccountingSettings,
  normalizeAccountingModulePreferences,
  stripAccountingFieldConfigForPersist,
  parseTenantScopedStorageKey,
} from "@mms/shared";

const SETTINGS_KEY = "accounting_settings";

export async function runMigration064(): Promise<void> {
  console.log("Migrating Accounting setup config to relational tables...");
  const db = getDb();

  const rows = await db.select().from(schema.objects);
  const settingsByTenant = new Map<string, Record<string, unknown>>();

  for (const row of rows) {
    const parsed = parseTenantScopedStorageKey(row.key);
    if (!parsed) continue;
    const tenant = parsed.subdomain.trim().toLowerCase();
    if (!tenant) continue;

    if (parsed.logicalKey === SETTINGS_KEY) {
      if (row.data && typeof row.data === "object" && !Array.isArray(row.data)) {
        settingsByTenant.set(tenant, row.data as Record<string, unknown>);
      }
    }
  }

  let migrated = 0;

  await withGlobalTenant(async (tx) => {
    for (const [tenant, raw] of settingsByTenant) {
      const [workspace] = await tx
        .select({ subdomain: schema.workspaces.subdomain })
        .from(schema.workspaces)
        .where(eq(schema.workspaces.subdomain, tenant))
        .limit(1);

      if (!workspace) {
        console.warn(
          `[Migration 064] Skipping orphaned Accounting settings for missing workspace: ${tenant}`,
        );
        continue;
      }

      const normalizedFieldConfig = normalizeAccountingSettings(raw);
      const normalizedPrefs = normalizeAccountingModulePreferences(raw);
      const fieldConfigOnly = stripAccountingFieldConfigForPersist(normalizedFieldConfig);

      const existingField = await tx
        .select({ workspaceSubdomain: schema.accountingFieldConfigs.workspaceSubdomain })
        .from(schema.accountingFieldConfigs)
        .where(eq(schema.accountingFieldConfigs.workspaceSubdomain, tenant))
        .limit(1);

      if (existingField.length === 0) {
        await tx.insert(schema.accountingFieldConfigs).values({
          workspaceSubdomain: tenant,
          config: fieldConfigOnly as never,
        } as never);
      }

      const existingPrefs = await tx
        .select({ workspaceSubdomain: schema.accountingModulePreferences.workspaceSubdomain })
        .from(schema.accountingModulePreferences)
        .where(eq(schema.accountingModulePreferences.workspaceSubdomain, tenant))
        .limit(1);

      if (existingPrefs.length === 0) {
        await tx.insert(schema.accountingModulePreferences).values({
          workspaceSubdomain: tenant,
          preferences: normalizedPrefs as never,
        } as never);
      }
      migrated++;
    }
  });

  console.log(`Migrated ${migrated} Accounting setup configs.`);
}
