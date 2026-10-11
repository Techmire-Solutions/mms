import { randomBytes } from "node:crypto";
import {
  type Workspace,
  SYSTEM_MODULES,
  normalizeUserModulePreferences,
  slugifySubdomain,
  isValidSubdomain,
  isWorkspaceEnabled,
} from "@mms/shared";
import { purgeTenantDataBySubdomain, runInTransaction } from "../db/database.js";
import { getRequestTenant } from "../lib/tenantContext.js";
import { redisGet, redisSet, redisDel, redisKeys } from "../lib/redis.js";
import {
  deleteWorkspaceRow,
  findWorkspaceRowBySubdomain,
  getWorkspaceGlobalSettings,
  getWorkspaceGrantedModulesRepo,
  insertWorkspaceRow,
  updateWorkspaceEnabledRow,
  updateWorkspaceGrantedAndEnabledModulesRepo,
  workspaceSubdomainExists,
} from "../db/repositories/workspaceRepository.js";
import {
  getUserModulePreferencesByWorkspace,
  upsertUserModulePreferences,
} from "../db/repositories/userModulePreferencesRepository.js";
import { clearModuleAvailabilityCache } from "../lib/moduleAvailabilityService.js";
import { broadcastTenantUpdate } from "../lib/livePush.js";

export {
  fetchPublicBrandingForSubdomain,
  getWorkspaceWithPublicBranding,
  getWorkspaceInstitutionSetupStatus,
  listPublicWorkspaces,
  listPlatformWorkspaces,
  getPlatformWorkspaceMetrics,
  getPlatformWorkspaceSummary,
  resetWorkspaceAdminPassword,
  createWorkspaceAdminUser,
  syncWorkspaceFromBranding,
  upsertWorkspaceBranding,
} from "./workspacePresentationService.js";

const WORKSPACE_CACHE_TTL_SECONDS = 300;
const workspaceCacheKey = (sub: string) => redisKeys.workspace(sub);

export function normalizeSubdomainInput(value: string): string {
  return slugifySubdomain(value);
}

export async function invalidateWorkspaceCache(subdomain: string): Promise<void> {
  const normalized = normalizeSubdomainInput(subdomain);
  if (!normalized) return;
  await redisDel(workspaceCacheKey(normalized));
  clearModuleAvailabilityCache(normalized);
  broadcastTenantUpdate(normalized, "object", "workspace");
  broadcastTenantUpdate(normalized, "object", "branding");
}

/** Permanently removes a workspace registry entry and all tenant-scoped data. */
export async function deleteWorkspace(subdomain: string): Promise<Workspace | null> {
  const normalized = normalizeSubdomainInput(subdomain);
  return runInTransaction(async () => {
    const ws = await getWorkspaceBySubdomain(normalized);
    if (!ws) return null;
    await purgeTenantDataBySubdomain(normalized);
    await deleteWorkspaceRow(normalized);
    return ws;
  });
}

export async function setWorkspaceEnabled(
  subdomain: string,
  enabled: boolean,
): Promise<Workspace | null> {
  const normalized = normalizeSubdomainInput(subdomain);
  const result = await runInTransaction(async () => {
    const ws = await getWorkspaceBySubdomain(normalized);
    if (!ws) return null;
    await updateWorkspaceEnabledRow(normalized, enabled);
    return { ...ws, enabled };
  });
  await invalidateWorkspaceCache(normalized);
  return result;
}

export async function setWorkspaceEmailVerification(
  subdomain: string,
  requireEmailVerification: boolean,
): Promise<{ subdomain: string; requireEmailVerification: boolean } | null> {
  const normalized = normalizeSubdomainInput(subdomain);
  const ws = await getWorkspaceBySubdomain(normalized);
  if (!ws) return null;

  const rawPrefs = await getUserModulePreferencesByWorkspace(normalized);
  const prefs = normalizeUserModulePreferences(rawPrefs);
  const updatedPrefs = {
    ...prefs,
    requireEmailVerification,
  };
  await upsertUserModulePreferences(normalized, updatedPrefs as Record<string, unknown>);
  return { subdomain: normalized, requireEmailVerification };
}

export async function assertWorkspaceActive(subdomain: string): Promise<Workspace> {
  const workspace = await getWorkspaceBySubdomain(subdomain);
  if (!workspace) {
    throw Object.assign(new Error("Workspace not found"), { statusCode: 404 });
  }
  if (!isWorkspaceEnabled(workspace)) {
    throw Object.assign(
      new Error("This madrasa workspace has been disabled by the platform administrator."),
      {
        statusCode: 403,
        type: "workspace_disabled",
      },
    );
  }
  return workspace;
}

export async function getWorkspaceBySubdomain(subdomain: string): Promise<Workspace | null> {
  const normalized = normalizeSubdomainInput(subdomain);
  if (!normalized) return null;
  const key = workspaceCacheKey(normalized);
  const cached = await redisGet(key);
  if (cached) {
    try {
      return JSON.parse(cached) as Workspace;
    } catch {
      // Fall through on JSON parse error
    }
  }

  const workspace = await findWorkspaceRowBySubdomain(normalized);
  if (workspace) {
    await redisSet(key, JSON.stringify(workspace), WORKSPACE_CACHE_TTL_SECONDS);
  }
  return workspace;
}

/** Resolves workspace for the active request tenant only — never falls back on apex. */
export async function getWorkspace(): Promise<Workspace | null> {
  const tenant = getRequestTenant();
  if (!tenant) return null;
  return getWorkspaceBySubdomain(tenant);
}

export async function isSubdomainAvailable(subdomain: string): Promise<boolean> {
  const normalized = normalizeSubdomainInput(subdomain);
  if (!isValidSubdomain(normalized)) return false;
  return !(await workspaceSubdomainExists(normalized));
}

export async function assertSubdomainAvailable(subdomain: string): Promise<void> {
  if (!isValidSubdomain(normalizeSubdomainInput(subdomain))) {
    throw Object.assign(
      new Error("Invalid subdomain. Use 2–63 lowercase letters, numbers, and hyphens."),
      {
        statusCode: 400,
      },
    );
  }
  if (!(await isSubdomainAvailable(subdomain))) {
    throw Object.assign(new Error("This workspace subdomain is already taken."), {
      statusCode: 409,
    });
  }
}

export async function createWorkspace(workspaceInput: {
  subdomain: string;
  madrasaName: string;
  tagline?: string;
  country?: string;
  industryType?: string;
}): Promise<Workspace> {
  const subdomain = normalizeSubdomainInput(workspaceInput.subdomain);
  if (!isValidSubdomain(subdomain)) {
    throw Object.assign(
      new Error("Invalid subdomain. Use 2–63 lowercase letters, numbers, and hyphens."),
      {
        statusCode: 400,
      },
    );
  }

  return runInTransaction(async () => {
    const existing = await getWorkspaceBySubdomain(subdomain);
    if (existing) {
      throw Object.assign(new Error("This workspace subdomain is already taken."), {
        statusCode: 409,
      });
    }

    const id = randomBytes(8).toString("hex");
    const newWs = {
      id,
      subdomain,
      madrasaName: workspaceInput.madrasaName,
      tagline: workspaceInput.tagline || null,
      country: workspaceInput.country || null,
      industryType: workspaceInput.industryType || "madrasa",
      enabled: true,
    };

    await insertWorkspaceRow(newWs);

    const { syncPlatformSuperUserToTenant } =
      await import("./platform/platformSuperUserTenantSyncService.js");
    await syncPlatformSuperUserToTenant(subdomain);

    const created: Workspace = {
      id: newWs.id,
      subdomain: newWs.subdomain,
      madrasaName: newWs.madrasaName,
      enabled: newWs.enabled,
      createdAt: new Date().toISOString(),
    };
    if (newWs.tagline) created.tagline = newWs.tagline;
    if (newWs.country) created.country = newWs.country;
    return created;
  });
}

/**
 * Returns granted module IDs for the specified workspace.
 */
export async function getWorkspaceGrantedModules(subdomain: string): Promise<string[]> {
  const normalized = normalizeSubdomainInput(subdomain);
  return getWorkspaceGrantedModulesRepo(normalized);
}

/**
 * Updates granted and enabled modules for the specified workspace.
 */
export async function updateWorkspaceModules(
  subdomain: string,
  modules: string[],
): Promise<{ modules: string[] }> {
  const normalized = normalizeSubdomainInput(subdomain);
  const globalSettings = await getWorkspaceGlobalSettings(normalized);
  const prevGrantedIds = await getWorkspaceGrantedModulesRepo(normalized);
  const prevGranted = Object.fromEntries(prevGrantedIds.map((id) => [id, true]));
  const prevEnabled = globalSettings?.enabledModules || {};

  const grantedModules: Record<string, boolean> = {};
  const enabledModules: Record<string, boolean> = { ...prevEnabled };
  const modulesSet = new Set(modules);

  for (const mod of SYSTEM_MODULES) {
    if (mod.required) {
      grantedModules[mod.id] = true;
      enabledModules[mod.id] = true;
    } else {
      const isGranted = modulesSet.has(mod.id);
      const wasGranted = prevGranted[mod.id] === true;
      grantedModules[mod.id] = isGranted;

      if (!isGranted) {
        enabledModules[mod.id] = false;
      } else if (!wasGranted) {
        enabledModules[mod.id] = true;
      }
    }
  }

  await updateWorkspaceGrantedAndEnabledModulesRepo(normalized, grantedModules, enabledModules);
  await invalidateWorkspaceCache(normalized);
  return { modules };
}
