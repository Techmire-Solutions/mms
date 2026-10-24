import { eq } from "drizzle-orm";
import type { Workspace } from "@mms/shared";
import { activeDb } from "../dbConnection.js";
import { workspaces as workspacesTable } from "../schema.js";
import {
  clearWorkspaceCacheForTests,
  ALL_WORKSPACE_COLUMNS,
  loadWorkspaceRow,
  invalidateWorkspaceCache,
} from "./workspaceRepositoryCache.js";
import { rowToWorkspace, rowToBranding } from "./workspaceRowMappers.js";

export {
  clearWorkspaceCacheForTests,
  ALL_WORKSPACE_COLUMNS,
  loadWorkspaceRow,
  invalidateWorkspaceCache,
  rowToWorkspace,
  rowToBranding,
};

export {
  listWorkspaceRowsWithBranding,
  getWorkspaceBranding,
  getWorkspaceWithBranding,
  updateWorkspaceBrandingRow,
  upsertWorkspaceBranding,
} from "./workspaceBrandingRepository.js";

export {
  rowToGlobalSettings,
  getWorkspaceGlobalSettings,
  upsertWorkspaceGlobalSettings,
  getWorkspaceGrantedModulesRepo,
  updateWorkspaceGrantedAndEnabledModulesRepo,
  findWorkspaceTimezone,
} from "./workspaceSettingsRepository.js";

export async function listWorkspaceRows(options?: {
  limit?: number;
  offset?: number;
}): Promise<Workspace[]> {
  const query = activeDb()
    .select({
      id: workspacesTable.id,
      subdomain: workspacesTable.subdomain,
      madrasaName: workspacesTable.madrasaName,
      tagline: workspacesTable.tagline,
      country: workspacesTable.country,
      enabled: workspacesTable.enabled,
      createdAt: workspacesTable.createdAt,
    })
    .from(workspacesTable);

  const rows =
    options?.limit !== undefined || options?.offset !== undefined
      ? await (
          query as unknown as {
            limit: (l: number) => {
              offset: (o: number) => Promise<(typeof workspacesTable.$inferSelect)[]>;
            };
          }
        )
          .limit(Math.min(Math.max(options?.limit ?? 500, 1), 5000))
          .offset(Math.max(options?.offset ?? 0, 0))
      : await query;

  return rows.map(rowToWorkspace);
}

/**
 * Returns true when a workspace with the given subdomain exists. Uses a single
 * indexed lookup instead of loading the entire workspaces table.
 */
export async function workspaceSubdomainExists(subdomain: string): Promise<boolean> {
  const rows = await activeDb()
    .select({ id: workspacesTable.id })
    .from(workspacesTable)
    .where(eq(workspacesTable.subdomain, subdomain))
    .limit(1);
  return rows.length > 0;
}

export async function findWorkspaceRowBySubdomain(subdomain: string): Promise<Workspace | null> {
  const ws = await loadWorkspaceRow(subdomain);
  return ws ? rowToWorkspace(ws) : null;
}

export async function insertWorkspaceRow(values: {
  id: string;
  subdomain: string;
  madrasaName: string;
  tagline?: string | null;
  country?: string | null;
  enabled?: boolean;
}): Promise<void> {
  await activeDb()
    .insert(workspacesTable)
    .values({
      id: values.id,
      subdomain: values.subdomain,
      madrasaName: values.madrasaName,
      tagline: values.tagline || null,
      country: values.country || null,
      enabled: values.enabled ?? true,
    });
  invalidateWorkspaceCache(values.subdomain);
}

export async function updateWorkspaceEnabledRow(
  subdomain: string,
  enabled: boolean,
): Promise<void> {
  await activeDb()
    .update(workspacesTable)
    .set({ enabled })
    .where(eq(workspacesTable.subdomain, subdomain));
  invalidateWorkspaceCache(subdomain);
}

export async function deleteWorkspaceRow(subdomain: string): Promise<void> {
  await activeDb().delete(workspacesTable).where(eq(workspacesTable.subdomain, subdomain));
  invalidateWorkspaceCache(subdomain);
}
