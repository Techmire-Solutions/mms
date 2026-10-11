import { eq } from "drizzle-orm";
import { getDb } from "../dbClient.js";
import * as schema from "../schema.js";
import { withGlobalTenant } from "../tenant-context.js";
import { invalidateWorkspaceCache } from "../../services/workspaceService.js";

/**
 * Migration 085: Backfills `obligations: true` into `grantedModules` and `enabledModules`
 * for existing workspaces that have module registries stored prior to the obligations module release.
 */
export async function runMigration085(): Promise<void> {
  const db = getDb();
  const workspaces = await db.select().from(schema.workspaces);
  let updatedCount = 0;

  await withGlobalTenant(async (tx) => {
    for (const ws of workspaces) {
      let needsUpdate = false;
      const granted = (ws.grantedModules as Record<string, boolean> | null)
        ? { ...(ws.grantedModules as Record<string, boolean>) }
        : null;
      const enabled = (ws.enabledModules as Record<string, boolean> | null)
        ? { ...(ws.enabledModules as Record<string, boolean>) }
        : null;

      if (granted && !Object.prototype.hasOwnProperty.call(granted, "obligations")) {
        granted.obligations = true;
        needsUpdate = true;
      }

      if (enabled && !Object.prototype.hasOwnProperty.call(enabled, "obligations")) {
        enabled.obligations = true;
        needsUpdate = true;
      }

      if (needsUpdate) {
        await tx
          .update(schema.workspaces)
          .set({
            ...(granted ? { grantedModules: granted } : {}),
            ...(enabled ? { enabledModules: enabled } : {}),
          })
          .where(eq(schema.workspaces.subdomain, ws.subdomain));

        await invalidateWorkspaceCache(ws.subdomain);
        updatedCount++;
      }
    }
  });

  console.log(
    `[Migration 085] Backfilled obligations module access for ${updatedCount} workspace(s).`,
  );
}
