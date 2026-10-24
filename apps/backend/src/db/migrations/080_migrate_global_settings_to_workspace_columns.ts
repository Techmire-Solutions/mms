/**
 * Migration 080: Copy global_settings and granted_modules from the `objects` store into the new
 * typed columns on the `workspaces` table (added by Drizzle migration 0072).
 *
 * Scans for `global_settings` and `platform_settings` per tenant subdomain, merges with defaults,
 * and writes into the `workspaces` row. Idempotent — safe to re-run.
 */
import { eq } from "drizzle-orm";
import { getDb } from "../dbClient.js";
import * as schema from "../schema.js";
import { withGlobalTenant } from "../tenant-context.js";
import { mergeGlobalSettings, parseTenantScopedStorageKey, SYSTEM_MODULES } from "@mms/shared";

const GLOBAL_SETTINGS_KEY = "global_settings";
const PLATFORM_SETTINGS_KEY = "platform_settings";

export async function runMigration080(): Promise<void> {
  console.log(
    "Migrating global_settings & granted_modules from objects store → workspaces columns...",
  );
  const db = getDb();

  const rows = await db.select().from(schema.objects);
  const globalByTenant = new Map<string, Record<string, unknown>>();
  const platformByTenant = new Map<string, Record<string, unknown>>();

  for (const row of rows) {
    const parsed = parseTenantScopedStorageKey(row.key);
    if (!parsed) continue;
    const tenant = parsed.subdomain.trim().toLowerCase();
    if (!tenant) continue;
    if (parsed.logicalKey === GLOBAL_SETTINGS_KEY) {
      if (row.data && typeof row.data === "object" && !Array.isArray(row.data)) {
        globalByTenant.set(tenant, row.data as Record<string, unknown>);
      }
    } else if (parsed.logicalKey === PLATFORM_SETTINGS_KEY) {
      if (row.data && typeof row.data === "object" && !Array.isArray(row.data)) {
        platformByTenant.set(tenant, row.data as Record<string, unknown>);
      }
    }
  }

  // Also ensure every workspace is processed even if it has no row in objects (uses defaults)
  const workspaces = await db
    .select({ subdomain: schema.workspaces.subdomain })
    .from(schema.workspaces);

  let migrated = 0;

  await withGlobalTenant(async (tx) => {
    for (const ws of workspaces) {
      const tenant = ws.subdomain;
      const rawGlobal = globalByTenant.get(tenant) ?? null;
      const rawPlatform = platformByTenant.get(tenant) ?? null;

      const g = mergeGlobalSettings(rawGlobal);

      let grantedModules: Record<string, boolean> = {};
      if (rawPlatform?.grantedModules && typeof rawPlatform.grantedModules === "object") {
        grantedModules = { ...(rawPlatform.grantedModules as Record<string, boolean>) };
      } else {
        // Default: grant all system modules
        for (const mod of SYSTEM_MODULES) {
          grantedModules[mod.id] = true;
        }
      }

      await tx
        .update(schema.workspaces)
        .set({
          language: g.language || null,
          timezone: g.timezone || null,
          dateFormat: g.dateFormat || null,
          emailNotifications: g.emailNotifications,
          smsNotifications: g.smsNotifications,
          twoFactor: g.twoFactor,
          sessionTimeout: g.sessionTimeout || null,
          passwordPolicy: g.passwordPolicy || null,
          theme: g.theme || null,
          enabledModules: g.enabledModules,
          grantedModules: grantedModules,
          llmProvider: g.llmProvider || null,
          llmApiKey: g.llmApiKey || null,
          llmConfigs: g.llmConfigs?.length ? g.llmConfigs : null,
        })
        .where(eq(schema.workspaces.subdomain, tenant));

      migrated++;
    }
  });

  console.log(`[Migration 080] Migrated global settings for ${migrated} workspace(s).`);
}
