import { eq } from "drizzle-orm";
import type { Workspace, BrandingSettings } from "@mms/shared";
import { activeDb } from "../dbConnection.js";
import { workspaces as workspacesTable } from "../schema.js";
import { loadWorkspaceRow, invalidateWorkspaceCache } from "./workspaceRepositoryCache.js";
import { rowToWorkspace, rowToBranding } from "./workspaceRowMappers.js";

/**
 * Lists all workspaces with their branding in a single query. Avoids the
 * N+1 pattern of fetching branding per workspace (used by the apex registry
 * and platform console listings).
 *
 * Intentionally omits LLM secrets (`llm_api_key`, `llm_configs`) — platform
 * list/summary responses must never project those columns.
 */
export async function listWorkspaceRowsWithBranding(): Promise<
  Array<{ workspace: Workspace; branding: BrandingSettings }>
> {
  const rows = await activeDb()
    .select({
      id: workspacesTable.id,
      subdomain: workspacesTable.subdomain,
      madrasaName: workspacesTable.madrasaName,
      tagline: workspacesTable.tagline,
      country: workspacesTable.country,
      enabled: workspacesTable.enabled,
      primaryColor: workspacesTable.primaryColor,
      secondaryColor: workspacesTable.secondaryColor,
      cornerStyle: workspacesTable.cornerStyle,
      logoUrl: workspacesTable.logoUrl,
      faviconUrl: workspacesTable.faviconUrl,
      footerText: workspacesTable.footerText,
      email: workspacesTable.email,
      phone: workspacesTable.phone,
      website: workspacesTable.website,
      legalName: workspacesTable.legalName,
      registrationNumber: workspacesTable.registrationNumber,
      addressLine1: workspacesTable.addressLine1,
      addressLine2: workspacesTable.addressLine2,
      city: workspacesTable.city,
      region: workspacesTable.region,
      postalCode: workspacesTable.postalCode,
      socialLinks: workspacesTable.socialLinks,
      createdAt: workspacesTable.createdAt,
    })
    .from(workspacesTable);
  return rows.map((ws) => ({
    workspace: rowToWorkspace(ws as unknown as typeof workspacesTable.$inferSelect),
    branding: rowToBranding(ws as unknown as typeof workspacesTable.$inferSelect),
  }));
}

/** Read all branding fields for a workspace. Returns null when workspace not found. */
export async function getWorkspaceBranding(subdomain: string): Promise<BrandingSettings | null> {
  try {
    const ws = await loadWorkspaceRow(subdomain);
    return ws ? rowToBranding(ws) : null;
  } catch {
    return null;
  }
}

/** Read workspace and branding together in a single query. */
export async function getWorkspaceWithBranding(subdomain: string): Promise<{
  workspace: Workspace;
  branding: BrandingSettings;
} | null> {
  try {
    const ws = await loadWorkspaceRow(subdomain);
    if (!ws) return null;
    return {
      workspace: rowToWorkspace(ws),
      branding: rowToBranding(ws),
    };
  } catch {
    return null;
  }
}

/** Sync name/tagline columns — used for registry display; branding save uses upsertWorkspaceBranding. */
export async function updateWorkspaceBrandingRow(
  subdomain: string,
  branding: { madrasaName: string; tagline?: string | null },
): Promise<void> {
  await activeDb()
    .update(workspacesTable)
    .set({
      madrasaName: branding.madrasaName.trim(),
      tagline: branding.tagline?.trim() || null,
    })
    .where(eq(workspacesTable.subdomain, subdomain));
  invalidateWorkspaceCache(subdomain);
}

/** Write the full BrandingSettings into the workspaces typed columns. */
export async function upsertWorkspaceBranding(
  subdomain: string,
  b: BrandingSettings,
): Promise<void> {
  await activeDb()
    .update(workspacesTable)
    .set({
      madrasaName: b.madrasaName.trim(),
      tagline: b.tagline?.trim() || null,
      primaryColor: b.primaryColor || null,
      secondaryColor: b.secondaryColor || null,
      cornerStyle: b.cornerStyle || null,
      logoUrl: b.logoUrl || null,
      faviconUrl: b.faviconUrl || null,
      footerText: b.footerText || null,
      email: b.email || null,
      phone: b.phone || null,
      website: b.website || null,
      legalName: b.legalName || null,
      registrationNumber: b.registrationNumber || null,
      addressLine1: b.addressLine1 || null,
      addressLine2: b.addressLine2 || null,
      city: b.city || null,
      region: b.region || null,
      postalCode: b.postalCode || null,
      country: b.country || null,
      socialLinks: b.socialLinks?.length ? b.socialLinks : null,
    })
    .where(eq(workspacesTable.subdomain, subdomain));
  invalidateWorkspaceCache(subdomain);
}
