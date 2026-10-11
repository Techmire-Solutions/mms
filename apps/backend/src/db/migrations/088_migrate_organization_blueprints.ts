import { eq } from "drizzle-orm";
import { getDb } from "../dbClient.js";
import * as schema from "../schema.js";
import { withGlobalTenant } from "../tenant-context.js";
import { invalidateWorkspaceCache } from "../../services/workspaceService.js";
import { SYSTEM_MODULES } from "@mms/shared";

/**
 * Migration 088:
 * Backfills newly added modules into existing workspaces' granted/enabled modules.
 * (Organization blueprint apply removed with the Organization module.)
 */
export async function runMigration088(): Promise<void> {
  const db = getDb();
  const workspaces = await db.select().from(schema.workspaces);
  let updatedModulesCount = 0;

  await withGlobalTenant(async (tx) => {
    for (const ws of workspaces) {
      let needsModuleUpdate = false;
      const granted = (ws.grantedModules as Record<string, boolean> | null)
        ? { ...(ws.grantedModules as Record<string, boolean>) }
        : {};
      const enabled = (ws.enabledModules as Record<string, boolean> | null)
        ? { ...(ws.enabledModules as Record<string, boolean>) }
        : {};

      for (const mod of SYSTEM_MODULES) {
        if (!Object.prototype.hasOwnProperty.call(granted, mod.id)) {
          granted[mod.id] = true;
          needsModuleUpdate = true;
        }

        if (!Object.prototype.hasOwnProperty.call(enabled, mod.id)) {
          enabled[mod.id] = true;
          needsModuleUpdate = true;
        }
      }

      if (needsModuleUpdate) {
        await tx
          .update(schema.workspaces)
          .set({
            grantedModules: granted,
            enabledModules: enabled,
          })
          .where(eq(schema.workspaces.subdomain, ws.subdomain));

        await invalidateWorkspaceCache(ws.subdomain);
        updatedModulesCount++;
      }
    }
  });

  console.log(`[Migration 088] Backfilled modules for ${updatedModulesCount} workspace(s).`);
}
