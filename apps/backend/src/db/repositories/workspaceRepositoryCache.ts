import { eq } from "drizzle-orm";
import { activeDb } from "../dbConnection.js";
import { workspaces as workspacesTable } from "../schema.js";

// ---------------------------------------------------------------------------
// In-process TTL cache for workspace rows.
//
// The workspace registry is small (one row per madrasa) and changes rarely, but
// it is read on EVERY authenticated request (the auth middleware resolves the
// workspace + global settings). Caching the row for a short TTL removes up to
// two full-table queries from the per-request hot path. Every write path below
// invalidates the entry immediately so mutations propagate without waiting for
// the TTL. The cache is bounded so arbitrary subdomain probes (e.g. the
// subdomain-availability check) cannot grow it without limit.
// ---------------------------------------------------------------------------
const WORKSPACE_CACHE_TTL_MS = 30_000;
const WORKSPACE_CACHE_MAX_ENTRIES = 500;
const workspaceCache = new Map<
  string,
  { row: typeof workspacesTable.$inferSelect; expiresAt: number }
>();

function readCachedWorkspaceRow(
  subdomain: string,
): typeof workspacesTable.$inferSelect | undefined {
  const entry = workspaceCache.get(subdomain);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    workspaceCache.delete(subdomain);
    return undefined;
  }
  return entry.row;
}

function writeCachedWorkspaceRow(
  subdomain: string,
  row: typeof workspacesTable.$inferSelect | null,
): void {
  if (row === null) {
    workspaceCache.delete(subdomain);
    return;
  }
  if (workspaceCache.size >= WORKSPACE_CACHE_MAX_ENTRIES) {
    const oldestKey = workspaceCache.keys().next().value;
    if (oldestKey !== undefined) workspaceCache.delete(oldestKey);
  }
  workspaceCache.set(subdomain, { row, expiresAt: Date.now() + WORKSPACE_CACHE_TTL_MS });
}

export function invalidateWorkspaceCache(subdomain: string): void {
  workspaceCache.delete(subdomain);
}

/** Test helper — clears the in-process workspace cache. */
export function clearWorkspaceCacheForTests(): void {
  workspaceCache.clear();
}

export const ALL_WORKSPACE_COLUMNS = {
  id: workspacesTable.id,
  subdomain: workspacesTable.subdomain,
  madrasaName: workspacesTable.madrasaName,
  tagline: workspacesTable.tagline,
  country: workspacesTable.country,
  industryType: workspacesTable.industryType,
  appliedBlueprintKey: workspacesTable.appliedBlueprintKey,
  appliedBlueprintVersion: workspacesTable.appliedBlueprintVersion,
  blueprintAppliedAt: workspacesTable.blueprintAppliedAt,
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
  language: workspacesTable.language,
  timezone: workspacesTable.timezone,
  dateFormat: workspacesTable.dateFormat,
  emailNotifications: workspacesTable.emailNotifications,
  smsNotifications: workspacesTable.smsNotifications,
  twoFactor: workspacesTable.twoFactor,
  sessionTimeout: workspacesTable.sessionTimeout,
  passwordPolicy: workspacesTable.passwordPolicy,
  theme: workspacesTable.theme,
  enabledModules: workspacesTable.enabledModules,
  grantedModules: workspacesTable.grantedModules,
  llmProvider: workspacesTable.llmProvider,
  llmApiKey: workspacesTable.llmApiKey,
  llmConfigs: workspacesTable.llmConfigs,
  createdAt: workspacesTable.createdAt,
  updatedAt: workspacesTable.updatedAt,
};

/**
 * Loads a workspace row by subdomain, serving from the in-process TTL cache
 * when possible. On a cache miss it runs a single indexed query and populates
 * the cache. Returns null when the workspace does not exist.
 */
export async function loadWorkspaceRow(
  subdomain: string,
): Promise<typeof workspacesTable.$inferSelect | null> {
  const cached = readCachedWorkspaceRow(subdomain);
  if (cached) return cached;
  const rows = await activeDb()
    .select(ALL_WORKSPACE_COLUMNS)
    .from(workspacesTable)
    .where(eq(workspacesTable.subdomain, subdomain))
    .limit(1);
  const ws = rows[0] ?? null;
  writeCachedWorkspaceRow(subdomain, ws);
  return ws;
}
