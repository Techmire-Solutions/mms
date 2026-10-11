import { eq } from "drizzle-orm";
import { getDb } from "../dbClient.js";
import * as schema from "../schema.js";
import { withGlobalTenant } from "../tenant-context.js";
import { invalidateWorkspaceCache } from "../../services/workspaceService.js";
import { SYSTEM_MODULES } from "@mms/shared";

/**
 * Migration 086: Backfills all canonical SYSTEM_MODULES (including `hasanat`) into `grantedModules`
 * and `enabledModules` for any existing workspaces where module entries are missing.
 */
export async function runMigration086(): Promise<void> {
  const db = getDb();
  const workspaces = await db.select().from(schema.workspaces);
  let updatedCount = 0;

  await withGlobalTenant(async (tx) => {
    for (const ws of workspaces) {
      let needsUpdate = false;
      const granted = (ws.grantedModules as Record<string, boolean> | null)
        ? { ...(ws.grantedModules as Record<string, boolean>) }
        : {};
      const enabled = (ws.enabledModules as Record<string, boolean> | null)
        ? { ...(ws.enabledModules as Record<string, boolean>) }
        : {};

      for (const mod of SYSTEM_MODULES) {
        if (!Object.prototype.hasOwnProperty.call(granted, mod.id)) {
          granted[mod.id] = true;
          needsUpdate = true;
        }

        if (!Object.prototype.hasOwnProperty.call(enabled, mod.id)) {
          enabled[mod.id] = true;
          needsUpdate = true;
        }
      }

      if (needsUpdate) {
        await tx
          .update(schema.workspaces)
          .set({
            grantedModules: granted,
            enabledModules: enabled,
          })
          .where(eq(schema.workspaces.subdomain, ws.subdomain));

        await invalidateWorkspaceCache(ws.subdomain);
        updatedCount++;
      }
    }
  });

  console.log(`[Migration 086] Backfilled system modules access for ${updatedCount} workspace(s).`);
}
