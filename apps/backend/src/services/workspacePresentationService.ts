import {
  type PublicWorkspaceSummary,
  type PlatformWorkspaceRow,
  type PlatformWorkspaceListResponse,
  type PlatformWorkspaceMetrics,
  type PlatformWorkspacesListQuery,
  type BrandingSettings,
  type UserModulePreferences,
  BRANDING_IDENTITY_FIELD_KEYS,
  DEFAULT_USERS_SETTINGS,
  mergeBrandingSettings,
  normalizeUserModulePreferences,
  isInstitutionSetupComplete,
  isWorkspaceEnabled,
  toPublicBranding,
} from "@mms/shared";
import { sql, count } from "drizzle-orm";
import { getDb } from "../db/database.js";
import { workspaces as workspacesTable } from "../db/schema.js";
import {
  getWorkspaceBranding,
  getWorkspaceWithBranding,
  listWorkspaceRowsWithBranding,
  listWorkspaceRowsPage,
  updateWorkspaceBrandingRow,
  upsertWorkspaceBranding as upsertWorkspaceBrandingRepo,
} from "../db/repositories/workspaceRepository.js";
import {
  getUserModulePreferencesByWorkspace,
  getUserModulePreferencesByWorkspaces,
} from "../db/repositories/userModulePreferencesRepository.js";
import { normalizeSubdomainInput, invalidateWorkspaceCache } from "./workspaceService.js";
import { getWorkspaceAdminEmailsMap } from "../db/repositories/workspaceAdminUserRepository.js";

export * from "../db/repositories/workspaceAdminUserRepository.js";

function mapWorkspaceSummaryRow(
  workspace: {
    subdomain: string;
    madrasaName: string;
    tagline?: string | null;
    enabled?: boolean;
    createdAt: string | Date;
  },
  branding: BrandingSettings | null | undefined,
  prefsRaw: Partial<UserModulePreferences> | Record<string, unknown> | null | undefined,
  adminEmailFromMap?: string,
): PlatformWorkspaceRow {
  const publicBranding = toPublicBranding(branding ? branding : mergeBrandingSettings(null));
  const prefs = normalizeUserModulePreferences(prefsRaw);
  const logoUrl = publicBranding.logoUrl?.trim();
  const adminEmail = adminEmailFromMap || (branding?.email ? branding.email : undefined);
  const createdAt =
    typeof workspace.createdAt === "string"
      ? workspace.createdAt
      : workspace.createdAt.toISOString();
  return {
    subdomain: workspace.subdomain,
    madrasaName: publicBranding.madrasaName || workspace.madrasaName,
    tagline: publicBranding.tagline || workspace.tagline || undefined,
    logoUrl: logoUrl || undefined,
    enabled: isWorkspaceEnabled(workspace),
    createdAt,
    requireEmailVerification:
      prefs.requireEmailVerification ?? DEFAULT_USERS_SETTINGS.requireEmailVerification,
    adminEmail,
  };
}

/** Cheap fleet KPI counts for platform dashboard / toolbar. */
export async function getPlatformWorkspaceMetrics(): Promise<PlatformWorkspaceMetrics> {
  const db = getDb();
  const [row] = await db
    .select({
      total: count(),
      active: sql<number>`count(*) filter (where ${workspacesTable.enabled} is distinct from false)`,
      inactive: sql<number>`count(*) filter (where ${workspacesTable.enabled} = false)`,
    })
    .from(workspacesTable);
  return {
    total: Number(row?.total ?? 0),
    active: Number(row?.active ?? 0),
    inactive: Number(row?.inactive ?? 0),
  };
}

/** Paginated workspaces for platform console (includes disabled). */
export async function listPlatformWorkspaces(
  query: PlatformWorkspacesListQuery = {},
): Promise<PlatformWorkspaceListResponse> {
  const page = query.page ?? 1;
  const pageSize = query.limit ?? 25;

  // Search/status/date/sort/pagination all run in SQL — only the current page is
  // hydrated (prefs + admin emails), avoiding an O(N) scan + in-memory sort.
  const { rows: pageRows, total } = await listWorkspaceRowsPage({
    search: query.search,
    status: query.status,
    sortField: query.sortField,
    sortDir: query.sortDir,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  const pageSubdomains = pageRows.map(({ workspace }) => workspace.subdomain);
  const prefsBySubdomain = await getUserModulePreferencesByWorkspaces(pageSubdomains);
  const adminEmailsBySubdomain = await getWorkspaceAdminEmailsMap(pageSubdomains);

  const workspaces = pageRows.map(({ workspace, branding }) =>
    mapWorkspaceSummaryRow(
      workspace,
      branding,
      prefsBySubdomain.get(workspace.subdomain.toLowerCase()) ?? null,
      adminEmailsBySubdomain.get(workspace.subdomain.toLowerCase()),
    ),
  );

  return { workspaces, total, page, pageSize };
}

/** Public branding for a workspace subdomain (login shell, registry cards). */
export async function fetchPublicBrandingForSubdomain(subdomain: string) {
  const branding = await getWorkspaceBranding(subdomain);
  return toPublicBranding(branding ? branding : mergeBrandingSettings(null));
}

/** Fetch workspace summary and public branding together in a single DB query. */
export async function getWorkspaceWithPublicBranding(subdomain: string) {
  const normalized = normalizeSubdomainInput(subdomain);
  const data = await getWorkspaceWithBranding(normalized);
  if (!data) return null;
  const branding = toPublicBranding(data.branding ? data.branding : mergeBrandingSettings(null));
  return {
    workspace: {
      subdomain: data.workspace.subdomain,
      madrasaName: branding.madrasaName || data.workspace.madrasaName,
      tagline: branding.tagline || data.workspace.tagline,
      enabled: isWorkspaceEnabled(data.workspace),
    },
    branding,
  };
}

/** Workspace-wide setup state derived from authoritative persisted branding. */
export async function getWorkspaceInstitutionSetupStatus(subdomain: string): Promise<boolean> {
  const branding = await getWorkspaceBranding(normalizeSubdomainInput(subdomain));
  return isInstitutionSetupComplete(branding);
}

/** All registered workspaces for apex picker (active only; public name from branding). */
export async function listPublicWorkspaces(): Promise<PublicWorkspaceSummary[]> {
  const rows = await listWorkspaceRowsWithBranding();
  const active = rows.filter(({ workspace }) => isWorkspaceEnabled(workspace));
  return active
    .map(({ workspace, branding }) => {
      const publicBranding = toPublicBranding(branding);
      const logoUrl = publicBranding.logoUrl?.trim();
      return {
        subdomain: workspace.subdomain,
        madrasaName: publicBranding.madrasaName || workspace.madrasaName,
        tagline: publicBranding.tagline || workspace.tagline,
        logoUrl: logoUrl || undefined,
      };
    })
    .sort((a, b) => a.madrasaName.localeCompare(b.madrasaName));
}

/** Single workspace row for platform console (avoids scanning full workspace list). */
export async function getPlatformWorkspaceSummary(
  subdomain: string,
): Promise<PlatformWorkspaceRow | null> {
  const normalized = normalizeSubdomainInput(subdomain);
  const data = await getWorkspaceWithBranding(normalized);
  if (!data) return null;
  const rawPrefs = await getUserModulePreferencesByWorkspace(normalized);
  const prefs = normalizeUserModulePreferences(rawPrefs);
  const publicBranding = toPublicBranding(
    data.branding ? data.branding : mergeBrandingSettings(null),
  );
  const logoUrl = publicBranding.logoUrl?.trim();
  const adminEmailsMap = await getWorkspaceAdminEmailsMap([normalized]);
  const adminEmail =
    adminEmailsMap.get(normalized.toLowerCase()) ||
    (data.branding?.email ? data.branding.email : undefined);
  const createdAt = String(data.workspace.createdAt);
  return {
    subdomain: data.workspace.subdomain,
    madrasaName: publicBranding.madrasaName || data.workspace.madrasaName,
    tagline: publicBranding.tagline || data.workspace.tagline,
    logoUrl: logoUrl || undefined,
    enabled: isWorkspaceEnabled(data.workspace),
    createdAt,
    requireEmailVerification:
      prefs.requireEmailVerification ?? DEFAULT_USERS_SETTINGS.requireEmailVerification,
    adminEmail,
  };
}

/** Keeps the global workspace registry in sync with saved branding name/tagline. */
export async function syncWorkspaceFromBranding(
  subdomain: string,
  branding: Pick<BrandingSettings, "madrasaName" | "tagline">,
): Promise<void> {
  const normalized = normalizeSubdomainInput(subdomain);
  await updateWorkspaceBrandingRow(normalized, branding);
  await invalidateWorkspaceCache(normalized);
}

/** Write the full BrandingSettings into the workspaces typed columns. */
export async function upsertWorkspaceBranding(
  subdomain: string,
  branding: BrandingSettings,
): Promise<void> {
  const normalized = normalizeSubdomainInput(subdomain);
  await upsertWorkspaceBrandingRepo(normalized, branding);
  await invalidateWorkspaceCache(normalized);
}

/**
 * Returns a copy of `incoming` with every institution-identity field forced back to
 * `current`'s value — used when the caller lacks `settings.branding.write` so a
 * non-admin save can only ever change the theme fields (colours, corner style,
 * footer), regardless of what the request body contains.
 */
export function sanitizeBrandingWrite(
  incoming: BrandingSettings,
  current: BrandingSettings,
): BrandingSettings {
  const sanitized = { ...incoming };
  for (const key of BRANDING_IDENTITY_FIELD_KEYS) {
    (sanitized as BrandingSettings)[key] = current[key] as never;
  }
  return sanitized;
}
