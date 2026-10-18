import { eq } from "drizzle-orm";
import { activeDb } from "../dbConnection.js";
import { workspaces as workspacesTable } from "../schema.js";

export interface WorkspaceModuleAccessRow {
  grantedModules: Record<string, boolean> | null;
  enabledModules: Record<string, boolean> | null;
}

/**
 * Reads platform grants and tenant enablement in one uncached query. Errors
 * propagate (no swallow-to-null) so the module gate can fail closed.
 */
export async function getWorkspaceModuleAccessRow(
  subdomain: string,
): Promise<WorkspaceModuleAccessRow | null> {
  const rows = await activeDb()
    .select({
      grantedModules: workspacesTable.grantedModules,
      enabledModules: workspacesTable.enabledModules,
    })
    .from(workspacesTable)
    .where(eq(workspacesTable.subdomain, subdomain))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    grantedModules: (row.grantedModules as Record<string, boolean> | null) ?? null,
    enabledModules: (row.enabledModules as Record<string, boolean> | null) ?? null,
  };
}
