import { and, asc, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import type { Workspace, BrandingSettings } from "@mms/shared";
import { activeDb } from "../dbConnection.js";
import { workspaces as workspacesTable } from "../schema.js";
import { loadWorkspaceRow, invalidateWorkspaceCache } from "./workspaceRepositoryCache.js";
import {
  rowToWorkspace,
  rowToBranding,
  rowToProvisionedAdmin,
  type ProvisionedWorkspaceAdmin,
} from "./workspaceRowMappers.js";

/**
 * Branding-bearing workspace columns projected by list/summary queries.
 * Intentionally omits LLM secrets (`llm_api_key`, `llm_configs`) — platform
 * list/summary responses must never project those columns.
 */
const WORKSPACE_BRANDING_PROJECTION = {
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
  adminName: workspacesTable.adminName,
  adminEmail: workspacesTable.adminEmail,
  adminGender: workspacesTable.adminGender,
  createdAt: workspacesTable.createdAt,
} as const;

type WorkspaceBrandingRow = typeof workspacesTable.$inferSelect;

function toWorkspaceWithBranding(ws: unknown): {
  workspace: Workspace;
  branding: BrandingSettings;
  provisionedAdmin: ProvisionedWorkspaceAdmin | null;
} {
  const row = ws as WorkspaceBrandingRow;
  return {
    workspace: rowToWorkspace(row),
    branding: rowToBranding(row),
    provisionedAdmin: rowToProvisionedAdmin(row),
  };
}

/**
 * Lists all workspaces with their branding in a single query. Avoids the
 * N+1 pattern of fetching branding per workspace (used by the apex registry).
 */
export async function listWorkspaceRowsWithBranding(): Promise<
  Array<{
    workspace: Workspace;
    branding: BrandingSettings;
    provisionedAdmin: ProvisionedWorkspaceAdmin | null;
  }>
> {
  const rows = await activeDb()
    .select({ ...WORKSPACE_BRANDING_PROJECTION })
    .from(workspacesTable);
  return rows.map(toWorkspaceWithBranding);
}

export interface WorkspaceRowsPageQuery {
  search?: string;
  status?: "all" | "active" | "inactive";
  sortField?: "name" | "subdomain" | "createdAt" | "status" | "madrasaName";
  sortDir?: "asc" | "desc";
  dateFrom?: string;
  dateTo?: string;
  limit: number;
  offset: number;
}

export interface WorkspaceRowsPage {
  rows: Array<{
    workspace: Workspace;
    branding: BrandingSettings;
    provisionedAdmin: ProvisionedWorkspaceAdmin | null;
  }>;
  total: number;
}

/**
 * Paginated, filtered, sorted workspace+branding listing — search/status/date
 * are pushed into SQL (previously an in-memory filter/sort over every row).
 */
export async function listWorkspaceRowsPage(
  query: WorkspaceRowsPageQuery,
): Promise<WorkspaceRowsPage> {
  const conditions = [];
  const search = (query.search ?? "").trim();
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(ilike(workspacesTable.madrasaName, pattern), ilike(workspacesTable.subdomain, pattern)),
    );
  }
  if (query.status === "active") conditions.push(eq(workspacesTable.enabled, true));
  if (query.status === "inactive") conditions.push(eq(workspacesTable.enabled, false));
  if (query.dateFrom) {
    conditions.push(sql`${workspacesTable.createdAt}::date >= ${query.dateFrom}`);
  }
  if (query.dateTo) {
    conditions.push(sql`${workspacesTable.createdAt}::date <= ${query.dateTo}`);
  }
  const where = conditions.length ? and(...conditions) : undefined;

  const sortField = query.sortField === "madrasaName" ? "name" : (query.sortField ?? "name");
  const column =
    sortField === "subdomain"
      ? workspacesTable.subdomain
      : sortField === "createdAt"
        ? workspacesTable.createdAt
        : sortField === "status"
          ? workspacesTable.enabled
          : workspacesTable.madrasaName;
  const orderBy = (query.sortDir ?? "asc") === "asc" ? asc(column) : desc(column);

  const db = activeDb();
  const [countRow] = await db.select({ total: count() }).from(workspacesTable).where(where);
  const rows = await db
    .select({ ...WORKSPACE_BRANDING_PROJECTION })
    .from(workspacesTable)
    .where(where)
    .orderBy(orderBy)
    .limit(query.limit)
    .offset(query.offset);

  return {
    rows: rows.map(toWorkspaceWithBranding),
    total: Number(countRow?.total ?? 0),
  };
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
  provisionedAdmin: ProvisionedWorkspaceAdmin | null;
} | null> {
  try {
    const ws = await loadWorkspaceRow(subdomain);
    if (!ws) return null;
    return {
      workspace: rowToWorkspace(ws),
      branding: rowToBranding(ws),
      provisionedAdmin: rowToProvisionedAdmin(ws),
    };
  } catch {
    return null;
  }
}

/**
 * Sync name/tagline columns — used for registry display; branding save uses
 * upsertWorkspaceBranding.
 *
 * `preserveMadrasaName` omits `madrasa_name` from the UPDATE entirely: the madrasa
 * name is platform-owned, so tenant-scoped writes can never change it (no
 * read-then-write race with a concurrent platform rename).
 */
export async function updateWorkspaceBrandingRow(
  subdomain: string,
  branding: { madrasaName: string; tagline?: string | null },
  options: { preserveMadrasaName?: boolean } = {},
): Promise<void> {
  await activeDb()
    .update(workspacesTable)
    .set({
      ...(options.preserveMadrasaName ? {} : { madrasaName: branding.madrasaName.trim() }),
      tagline: branding.tagline?.trim() || null,
    })
    .where(eq(workspacesTable.subdomain, subdomain));
  invalidateWorkspaceCache(subdomain);
}

/**
 * Write the full BrandingSettings into the workspaces typed columns.
 *
 * `preserveMadrasaName` keeps the platform-owned `madrasa_name` untouched for
 * tenant-scoped writes (settings, institution setup, backup restore).
 */
export async function upsertWorkspaceBranding(
  subdomain: string,
  b: BrandingSettings,
  options: { preserveMadrasaName?: boolean } = {},
): Promise<void> {
  await activeDb()
    .update(workspacesTable)
    .set({
      ...(options.preserveMadrasaName ? {} : { madrasaName: b.madrasaName.trim() }),
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
