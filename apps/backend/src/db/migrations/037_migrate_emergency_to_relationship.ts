import {
  migrateEmergencyTabToRelationship,
  parseTenantScopedStorageKey,
  type FieldConfig,
} from "@mms/shared";
import { eq, sql } from "drizzle-orm";
import { getDb } from "../dbClient.js";
import * as schema from "../schema.js";
import { withGlobalTenant } from "../tenant-context.js";

/**
 * Renames contact JSONB `emergencyContacts` → `relationshipContacts` and remaps
 * persisted contact field-config emergency tab keys to relationship.
 */
export async function runMigration037(): Promise<void> {
  const db = getDb();
  let configCount = 0;

  await withGlobalTenant(async (tx) => {
    const colCheck = (await tx.execute(sql`
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'contacts' AND column_name = 'custom_data'
    `)) as unknown;
    const hasCustomData =
      typeof colCheck === "object" && colCheck !== null && "rowCount" in colCheck
        ? Number((colCheck as { rowCount?: number }).rowCount ?? 0) > 0
        : Array.isArray(colCheck) && (colCheck as unknown[]).length > 0;

    if (hasCustomData) {
      await tx.execute(sql`
        UPDATE contacts
        SET
          custom_data = (custom_data - 'emergencyContacts')
            || jsonb_build_object(
              'relationshipContacts',
              COALESCE(custom_data->'relationshipContacts', custom_data->'emergencyContacts')
            ),
          updated_at = NOW()
        WHERE custom_data ? 'emergencyContacts'
      `);
    }

    const fieldConfigRows = await tx.select().from(schema.contactFieldConfigs);
    for (const row of fieldConfigRows) {
      if (!row.config || typeof row.config !== "object" || Array.isArray(row.config)) continue;
      const config = row.config as unknown as FieldConfig;
      const migrated = migrateEmergencyTabToRelationship(config);
      if (JSON.stringify(config) === JSON.stringify(migrated)) continue;
      await tx
        .update(schema.contactFieldConfigs)
        .set({ config: migrated as unknown as Record<string, unknown> })
        .where(eq(schema.contactFieldConfigs.workspaceSubdomain, row.workspaceSubdomain));
      configCount += 1;
    }
  });

  const objectRows = await db.select().from(schema.objects);

  for (const row of objectRows) {
    const parsed = parseTenantScopedStorageKey(row.key);
    const logicalKey = parsed?.logicalKey ?? row.key;
    if (logicalKey !== "contact_field_config") continue;
    if (!row.data || typeof row.data !== "object" || Array.isArray(row.data)) continue;

    const config = row.data as FieldConfig;
    const migrated = migrateEmergencyTabToRelationship(config);
    if (JSON.stringify(config) === JSON.stringify(migrated)) continue;

    await db.update(schema.objects).set({ data: migrated }).where(eq(schema.objects.key, row.key));
    configCount += 1;
  }

  if (configCount > 0) {
    console.log(`[Migration 037] Remapped contact field config for ${configCount} tenants.`);
  }
}
