import { eq } from "drizzle-orm";
import {
  type Workspace,
  type BrandingSettings,
  type GlobalSettings,
  mergeGlobalSettings,
  SYSTEM_MODULES,
} from "@mms/shared";
import { activeDb } from "../dbConnection.js";
import { workspaces as workspacesTable } from "../schema.js";
import {
  decryptLlmApiKey,
  decryptLlmConfigs,
  encryptLlmApiKey,
  encryptLlmConfigs,
} from "./workspaceLlmSecrets.js";

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
    // Bounded memory: evict the oldest entry (Map preserves insertion order)
    // instead of clearing the whole cache, so a burst of >500 active subdomains
    // doesn't thrash every lookup. Re-population is a single indexed query.
    const oldestKey = workspaceCache.keys().next().value;
    if (oldestKey !== undefined) workspaceCache.delete(oldestKey);
  }
  workspaceCache.set(subdomain, { row, expiresAt: Date.now() + WORKSPACE_CACHE_TTL_MS });
}

function invalidateWorkspaceCache(subdomain: string): void {
  workspaceCache.delete(subdomain);
}

/** Test helper — clears the in-process workspace cache. */
export function clearWorkspaceCacheForTests(): void {
  workspaceCache.clear();
}

function rowToWorkspace(ws: {
  id: string;
  subdomain: string;
  madrasaName: string;
  tagline?: string | null;
  country?: string | null;
  industryType?: string | null;
  enabled: boolean;
  createdAt: Date;
}): Workspace {
  const item: Workspace = {
    id: ws.id,
    subdomain: ws.subdomain,
    madrasaName: ws.madrasaName,
    enabled: ws.enabled,
    createdAt: ws.createdAt.toISOString(),
  };
  if (ws.tagline) item.tagline = ws.tagline;
  if (ws.country) item.country = ws.country;
  if (ws.industryType) item.industryType = ws.industryType;
  return item;
}

/** Map nullable workspace columns back to a BrandingSettings shape. */
function rowToBranding(ws: typeof workspacesTable.$inferSelect): BrandingSettings {
  return {
    madrasaName: ws.madrasaName,
    tagline: ws.tagline ?? "",
    primaryColor: ws.primaryColor ?? "",
    secondaryColor: ws.secondaryColor ?? "",
    cornerStyle: (ws.cornerStyle as BrandingSettings["cornerStyle"]) ?? "rounded",
    logoUrl: ws.logoUrl ?? "",
    faviconUrl: ws.faviconUrl ?? "",
    footerText: ws.footerText ?? "",
    email: ws.email ?? "",
    phone: ws.phone ?? "",
    website: ws.website ?? "",
    legalName: ws.legalName ?? "",
    registrationNumber: ws.registrationNumber ?? "",
    addressLine1: ws.addressLine1 ?? "",
    addressLine2: ws.addressLine2 ?? "",
    city: ws.city ?? "",
    region: ws.region ?? "",
    postalCode: ws.postalCode ?? "",
    country: ws.country ?? "",
    socialLinks: (ws.socialLinks as BrandingSettings["socialLinks"]) ?? [],
  };
}

/** Map nullable workspace columns back to a GlobalSettings shape (with defaults). */
function rowToGlobalSettings(ws: typeof workspacesTable.$inferSelect): GlobalSettings {
  const overrides: Partial<GlobalSettings> = {};
  if (ws.language) overrides.language = ws.language as GlobalSettings["language"];
  if (ws.timezone) overrides.timezone = ws.timezone;
  if (ws.dateFormat) overrides.dateFormat = ws.dateFormat;
  if (ws.emailNotifications != null) overrides.emailNotifications = ws.emailNotifications;
  if (ws.smsNotifications != null) overrides.smsNotifications = ws.smsNotifications;
  if (ws.twoFactor != null) overrides.twoFactor = ws.twoFactor;
  if (ws.sessionTimeout != null) overrides.sessionTimeout = ws.sessionTimeout;
  if (ws.passwordPolicy)
    overrides.passwordPolicy = ws.passwordPolicy as GlobalSettings["passwordPolicy"];
  if (ws.theme) overrides.theme = ws.theme as GlobalSettings["theme"];
  if (ws.enabledModules) overrides.enabledModules = ws.enabledModules as Record<string, boolean>;
  if (ws.llmProvider) overrides.llmProvider = ws.llmProvider as GlobalSettings["llmProvider"];
  const llmApiKey = decryptLlmApiKey(ws.llmApiKey);
  if (llmApiKey) overrides.llmApiKey = llmApiKey;
  const llmConfigs = decryptLlmConfigs(ws.llmConfigs as GlobalSettings["llmConfigs"] | null);
  if (llmConfigs) overrides.llmConfigs = llmConfigs;
  return mergeGlobalSettings(overrides);
}

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

const ALL_WORKSPACE_COLUMNS = {
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

/**
 * Loads a workspace row by subdomain, serving from the in-process TTL cache
 * when possible. On a cache miss it runs a single indexed query and populates
 * the cache. Returns null when the workspace does not exist.
 */
async function loadWorkspaceRow(
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

export async function findWorkspaceRowBySubdomain(subdomain: string): Promise<Workspace | null> {
  const ws = await loadWorkspaceRow(subdomain);
  return ws ? rowToWorkspace(ws) : null;
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

/** Read all global settings for a workspace. Returns null when workspace not found. */
export async function getWorkspaceGlobalSettings(
  subdomain: string,
): Promise<GlobalSettings | null> {
  try {
    const ws = await loadWorkspaceRow(subdomain);
    return ws ? rowToGlobalSettings(ws) : null;
  } catch {
    return null;
  }
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

/** Write the full GlobalSettings into the workspaces typed columns. */
export async function upsertWorkspaceGlobalSettings(
  subdomain: string,
  g: GlobalSettings,
): Promise<void> {
  await activeDb()
    .update(workspacesTable)
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
      llmProvider: g.llmProvider || null,
      llmApiKey: encryptLlmApiKey(g.llmApiKey),
      llmConfigs: encryptLlmConfigs(g.llmConfigs),
    })
    .where(eq(workspacesTable.subdomain, subdomain));
  invalidateWorkspaceCache(subdomain);
}

/** Returns granted module IDs for the specified workspace. */
export async function getWorkspaceGrantedModulesRepo(subdomain: string): Promise<string[]> {
  const rows = await activeDb()
    .select({
      grantedModules: workspacesTable.grantedModules,
    })
    .from(workspacesTable)
    .where(eq(workspacesTable.subdomain, subdomain));
  const ws = rows[0];
  const granted = (ws?.grantedModules as Record<string, boolean> | undefined) || {};
  if (!ws?.grantedModules || Object.keys(granted).length === 0) {
    return SYSTEM_MODULES.map((m) => m.id);
  }
  const grantedIds: string[] = [];
  for (const id in granted) {
    if (Object.prototype.hasOwnProperty.call(granted, id) && granted[id]) {
      grantedIds.push(id);
    }
  }
  for (const mod of SYSTEM_MODULES) {
    if (!Object.prototype.hasOwnProperty.call(granted, mod.id)) {
      grantedIds.push(mod.id);
    }
  }
  return grantedIds;
}

/** Atomically updates granted and enabled modules on the workspace. */
export async function updateWorkspaceGrantedAndEnabledModulesRepo(
  subdomain: string,
  grantedModules: Record<string, boolean>,
  enabledModules: Record<string, boolean>,
): Promise<void> {
  await activeDb()
    .update(workspacesTable)
    .set({
      grantedModules,
      enabledModules,
    })
    .where(eq(workspacesTable.subdomain, subdomain));
  invalidateWorkspaceCache(subdomain);
}

export async function deleteWorkspaceRow(subdomain: string): Promise<void> {
  await activeDb().delete(workspacesTable).where(eq(workspacesTable.subdomain, subdomain));
  invalidateWorkspaceCache(subdomain);
}

/** IANA timezone of a workspace (business-day authority); null when unset. */
export async function findWorkspaceTimezone(subdomain: string): Promise<string | null> {
  const [row] = await activeDb()
    .select({ timezone: workspacesTable.timezone })
    .from(workspacesTable)
    .where(eq(workspacesTable.subdomain, subdomain.trim().toLowerCase()))
    .limit(1);
  return row?.timezone ?? null;
}
