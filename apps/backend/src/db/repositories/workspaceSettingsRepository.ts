import { eq } from "drizzle-orm";
import {
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
import { loadWorkspaceRow, invalidateWorkspaceCache } from "./workspaceRepositoryCache.js";

/** Map nullable workspace columns back to a GlobalSettings shape (with defaults). */
export function rowToGlobalSettings(ws: typeof workspacesTable.$inferSelect): GlobalSettings {
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

/** IANA timezone of a workspace (business-day authority); null when unset. */
export async function findWorkspaceTimezone(subdomain: string): Promise<string | null> {
  const [row] = await activeDb()
    .select({ timezone: workspacesTable.timezone })
    .from(workspacesTable)
    .where(eq(workspacesTable.subdomain, subdomain.trim().toLowerCase()))
    .limit(1);
  return row?.timezone ?? null;
}
