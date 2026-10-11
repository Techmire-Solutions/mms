import { eq } from "drizzle-orm";
import { getDb } from "../dbClient.js";
import * as schema from "../schema.js";
import { withGlobalTenant } from "../tenant-context.js";
import {
  normalizeAttendanceSettings,
  normalizeAttendanceModulePreferences,
  stripAttendanceFieldConfigForPersist,
  parseTenantScopedStorageKey,
} from "@mms/shared";

const SETTINGS_KEY = "attendance_settings";

export async function runMigration062(): Promise<void> {
  console.log("Migrating Attendance setup config to relational tables...");
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
          `[Migration 062] Skipping orphaned Attendance settings for missing workspace: ${tenant}`,
        );
        continue;
      }

      const normalizedFieldConfig = normalizeAttendanceSettings(raw);
      const normalizedPrefs = normalizeAttendanceModulePreferences(raw);
      const fieldConfigOnly = stripAttendanceFieldConfigForPersist(normalizedFieldConfig);

      const existingField = await tx
        .select({ workspaceSubdomain: schema.attendanceFieldConfigs.workspaceSubdomain })
        .from(schema.attendanceFieldConfigs)
        .where(eq(schema.attendanceFieldConfigs.workspaceSubdomain, tenant))
        .limit(1);

      if (existingField.length === 0) {
        await tx.insert(schema.attendanceFieldConfigs).values({
          workspaceSubdomain: tenant,
          config: fieldConfigOnly as never,
        } as never);
      }

      const existingPrefs = await tx
        .select({ workspaceSubdomain: schema.attendanceModulePreferences.workspaceSubdomain })
        .from(schema.attendanceModulePreferences)
        .where(eq(schema.attendanceModulePreferences.workspaceSubdomain, tenant))
        .limit(1);

      if (existingPrefs.length === 0) {
        await tx.insert(schema.attendanceModulePreferences).values({
          workspaceSubdomain: tenant,
          preferences: normalizedPrefs as never,
        } as never);
      }
      migrated++;
    }
  });

  console.log(`Migrated ${migrated} Attendance setup configs.`);
}
