import {
  DEFAULT_GLOBAL_SETTINGS,
  GLOBAL_SETTINGS_ADMIN_FIELD_KEYS,
  mergeGlobalSettings,
  parseSessionTimeoutMinutes,
  validatePasswordPolicy,
  type GlobalSettings,
} from "@mms/shared";
import { getRequestTenant } from "../lib/tenantContext.js";
import {
  getWorkspaceGlobalSettings,
  upsertWorkspaceGlobalSettings as upsertWorkspaceGlobalSettingsRepo,
} from "../db/repositories/workspaceRepository.js";
import { saveObject } from "../db/database.js";
import { redisDel, redisKeys } from "../lib/redis.js";
import { getOrSetMultiTier, invalidateMultiTierCache } from "../lib/cache/index.js";

const MASK_PREFIX = "****";
const GLOBAL_SETTINGS_CACHE_TTL_SECONDS = 300;
const globalSettingsCacheKey = (t: string) => redisKeys.globalSettings(t);

export async function invalidateGlobalSettingsCache(tenant: string): Promise<void> {
  const cleanTenant = tenant.trim().toLowerCase();
  if (!cleanTenant) return;
  const key = globalSettingsCacheKey(cleanTenant);
  await redisDel(key);
  await invalidateMultiTierCache({ tenantId: cleanTenant, domain: "global_settings", key });
}

/**
 * Masks a secret for client responses, showing only the last 4 characters.
 * Empty/undefined values stay empty so the UI can distinguish "not set".
 */
export function maskSecret(value: string | undefined): string {
  if (!value) return "";
  if (value.length <= 4) return MASK_PREFIX;
  return `${MASK_PREFIX}${value.slice(-4)}`;
}

/** True when a value is a masked secret (i.e. produced by maskSecret). */
export function isMaskedSecret(value: string | undefined): boolean {
  return typeof value === "string" && value.startsWith(MASK_PREFIX);
}

/**
 * Returns a client-safe copy of global settings with all LLM secrets masked
 * (the legacy `llmApiKey` and each `llmConfigs[].apiKey`). The full secrets
 * stay server-side only.
 */
export function maskGlobalSettingsForClient(settings: GlobalSettings): GlobalSettings {
  return {
    ...settings,
    llmApiKey: maskSecret(settings.llmApiKey),
    llmConfigs: (settings.llmConfigs ?? []).map((config) => ({
      ...config,
      apiKey: maskSecret(config.apiKey),
    })),
  };
}

/**
 * Returns a copy of `settings` with every admin-only field (notifications, security,
 * AI assistance, system modules) reset to its default — used when the caller lacks
 * `settings.global.write` so a non-admin read never reveals those values.
 */
export function redactAdminOnlyGlobalSettings(settings: GlobalSettings): GlobalSettings {
  const redacted = { ...settings };
  for (const key of GLOBAL_SETTINGS_ADMIN_FIELD_KEYS) {
    (redacted as GlobalSettings)[key] = DEFAULT_GLOBAL_SETTINGS[key] as never;
  }
  return redacted;
}

/**
 * Returns a copy of `incoming` with every admin-only field forced back to `current`'s
 * value — used when the caller lacks `settings.global.write` so a non-admin save can
 * only ever change the public fields (Language & Region, Theme), regardless of what
 * the request body contains.
 */
export function sanitizeGlobalSettingsWrite(
  incoming: GlobalSettings,
  current: GlobalSettings,
): GlobalSettings {
  const sanitized = { ...incoming };
  for (const key of GLOBAL_SETTINGS_ADMIN_FIELD_KEYS) {
    (sanitized as GlobalSettings)[key] = current[key] as never;
  }
  return sanitized;
}

/** Loads merged global settings for the current request tenant (or specified subdomain). */
export async function loadGlobalSettings(subdomain?: string): Promise<GlobalSettings> {
  const tenant = subdomain ?? getRequestTenant();
  if (!tenant) {
    return mergeGlobalSettings(null);
  }
  const cleanTenant = tenant.trim().toLowerCase();
  const key = globalSettingsCacheKey(cleanTenant);
  return getOrSetMultiTier(
    cleanTenant,
    "global_settings",
    key,
    async () => {
      try {
        const settings = await getWorkspaceGlobalSettings(cleanTenant);
        return settings ? mergeGlobalSettings(settings) : mergeGlobalSettings(null);
      } catch {
        return mergeGlobalSettings(null);
      }
    },
    { ttlSeconds: GLOBAL_SETTINGS_CACHE_TTL_SECONDS },
  );
}

/** Saves full global settings for the current request tenant (or specified subdomain). */
export async function saveGlobalSettings(
  settings: GlobalSettings,
  subdomain?: string,
): Promise<void> {
  const tenant = subdomain ?? getRequestTenant();
  if (!tenant) {
    throw new Error("Tenant context required to save global settings");
  }
  // Round-trip guard: the client only ever holds masked LLM secrets. If an
  // incoming value is masked (or empty), preserve the currently-stored full
  // secret so a settings save from the UI never overwrites the real key with
  // the masked placeholder. A genuinely new key (not masked) is stored as-is.
  const current = await getWorkspaceGlobalSettings(tenant);
  const currentConfigs = current?.llmConfigs ?? [];
  const currentConfigById = new Map(currentConfigs.map((config) => [config.id, config]));
  if (isMaskedSecret(settings.llmApiKey) || !settings.llmApiKey) {
    settings = { ...settings, llmApiKey: current?.llmApiKey ?? "" };
  }
  const llmConfigs = (settings.llmConfigs ?? []).map((config) => {
    if (isMaskedSecret(config.apiKey) || !config.apiKey) {
      const existing = currentConfigById.get(config.id);
      return { ...config, apiKey: existing?.apiKey ?? "" };
    }
    return config;
  });
  settings = { ...settings, llmConfigs };
  await upsertWorkspaceGlobalSettingsRepo(tenant, settings);
  await saveObject("global_settings", settings);
  await invalidateGlobalSettingsCache(tenant);
}

/** JWT `expiresIn` string from session timeout preference. */
export async function getJwtExpiresIn(): Promise<string> {
  const settings = await loadGlobalSettings();
  return `${parseSessionTimeoutMinutes(settings.sessionTimeout)}m`;
}

/**
 * Validates password against stored policy. Throws Error with statusCode 400 when invalid.
 */
export async function assertPasswordMeetsPolicy(password: string): Promise<void> {
  const settings = await loadGlobalSettings();
  const result = validatePasswordPolicy(password, settings.passwordPolicy);
  if (!result.valid) {
    const err = new Error(result.message);
    (err as Error & { statusCode: number }).statusCode = 400;
    throw err;
  }
}
