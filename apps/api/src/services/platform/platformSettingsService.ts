import type { PlatformSettings, PlatformSettingsUpdateInput, LlmConfig } from "@mms/contracts";
import { DEFAULT_PLATFORM_SETTINGS, mergePlatformSettings } from "@mms/contracts";
import {
  findPlatformSettingsRow,
  insertPlatformSettingsDefaultRow,
  upsertPlatformSettingsRow,
} from "../../platform/repository/platformSettingsAdapter.js";
import { logger } from "../../lib/logger.js";
import { redisGet, redisSet } from "../../lib/redis.js";
import { invalidateMultiTierCache } from "@mms/be-core/cache";

export const REDIS_PLATFORM_SETTINGS_KEY = "platform:settings:global";

const MASK_PREFIX = "****";

let cachedPlatformSettings: PlatformSettings = { ...DEFAULT_PLATFORM_SETTINGS };

/** True when the value is a masked secret produced by `maskPlatformSettingsForClient`. */
export function isMaskedPlatformSecret(value: string | undefined | null): boolean {
  return typeof value === "string" && value.startsWith(MASK_PREFIX);
}

/**
 * Client-safe copy: LLM API keys are masked for every reader. The full secrets
 * stay server-side only and are reused by the platform AI service.
 */
export function maskPlatformSettingsForClient(settings: PlatformSettings): PlatformSettings {
  return {
    ...settings,
    llmApiKey: settings.llmApiKey ? `${MASK_PREFIX}${settings.llmApiKey.slice(-4)}` : "",
    llmConfigs: settings.llmConfigs.map((config) => ({
      ...config,
      apiKey: config.apiKey ? `${MASK_PREFIX}${config.apiKey.slice(-4)}` : "",
    })),
  };
}

/**
 * Initializes the in-memory platform settings cache from Redis or PostgreSQL on startup.
 * Creates the single 'global' row if it does not exist yet.
 */
export async function initPlatformSettings(): Promise<PlatformSettings> {
  try {
    const cached = await redisGet(REDIS_PLATFORM_SETTINGS_KEY);
    if (cached) {
      try {
        cachedPlatformSettings = mergePlatformSettings(
          JSON.parse(cached) as Partial<PlatformSettings>,
        );
        return cachedPlatformSettings;
      } catch {
        // Fall back to database query
      }
    }

    const existing = await findPlatformSettingsRow();
    if (existing) {
      cachedPlatformSettings = mergePlatformSettings(existing);
    } else {
      const defaultSyncTls = process.env.MMS_SYNC_TLS_ON_CREATE !== "false";
      const defaultTlsExtraSans = process.env.MMS_TLS_EXTRA_SANS?.trim() || "";
      const defaultCertbotEmail = process.env.MMS_CERTBOT_EMAIL?.trim() || "";

      const inserted = await insertPlatformSettingsDefaultRow({
        syncTlsOnCreate: defaultSyncTls,
        tlsExtraSans: defaultTlsExtraSans,
        certbotEmail: defaultCertbotEmail,
      });

      if (inserted) {
        cachedPlatformSettings = mergePlatformSettings(inserted);
      }
    }

    try {
      await redisSet(REDIS_PLATFORM_SETTINGS_KEY, JSON.stringify(cachedPlatformSettings), 86400);
    } catch {
      // Non-fatal
    }
  } catch (error) {
    logger.warn(
      { err: error },
      "Failed to initialize platform settings from database; using defaults",
    );
  }

  return cachedPlatformSettings;
}

/**
 * Returns in-memory cached platform settings for fast access without DB lookups.
 * Returns a copy so callers cannot mutate the shared cache.
 */
export function getPlatformSettings(): PlatformSettings {
  return {
    ...cachedPlatformSettings,
    llmConfigs: cachedPlatformSettings.llmConfigs.map((config) => ({ ...config })),
  };
}

/** Keeps the stored secret when the client sends the masked placeholder or omits the field. */
function retainSecret(incoming: string | undefined, stored: string): string {
  if (incoming === undefined) return stored;
  if (isMaskedPlatformSecret(incoming)) return stored;
  return incoming;
}

function retainConfigSecrets(
  incoming: LlmConfig[] | undefined,
  stored: LlmConfig[],
): LlmConfig[] | undefined {
  if (!incoming) return undefined;
  return incoming.map((config) => {
    const previous = stored.find((candidate) => candidate.id === config.id);
    return {
      ...config,
      apiKey: retainSecret(config.apiKey, previous?.apiKey ?? ""),
    };
  });
}

/** Applies a validated patch over the current record (secret round-trip guarded). */
export function mergePlatformSettingsInput(
  current: PlatformSettings,
  input: PlatformSettingsUpdateInput,
): PlatformSettings {
  const patch = { ...input } as Partial<PlatformSettings>;
  delete (patch as { expectedUpdatedAt?: string }).expectedUpdatedAt;
  if (patch.llmApiKey !== undefined) {
    patch.llmApiKey = retainSecret(patch.llmApiKey, current.llmApiKey);
  }
  if (patch.llmConfigs !== undefined) {
    const nextConfigs = retainConfigSecrets(patch.llmConfigs, current.llmConfigs);
    if (nextConfigs) patch.llmConfigs = nextConfigs;
  }
  return mergePlatformSettings({ ...current, ...patch });
}

/** Replaces the in-memory cache after a transaction commits (combined appearance saves). */
export function setPlatformSettingsCache(next: PlatformSettings): void {
  cachedPlatformSettings = mergePlatformSettings(next);
}

/**
 * Updates platform settings in PostgreSQL and updates the in-memory cache and L2 Redis instantly.
 */
export async function updatePlatformSettings(
  input: PlatformSettingsUpdateInput,
): Promise<PlatformSettings> {
  const current = getPlatformSettings();
  const next = await upsertPlatformSettingsRow(mergePlatformSettingsInput(current, input));
  cachedPlatformSettings = next;
  try {
    await redisSet(REDIS_PLATFORM_SETTINGS_KEY, JSON.stringify(next), 86400);
  } catch {
    // Non-fatal
  }
  await invalidateMultiTierCache({
    tenantId: "platform",
    domain: "settings",
    key: "global",
  });
  return { ...next, llmConfigs: next.llmConfigs.map((config) => ({ ...config })) };
}

/** Resolved default LLM config for the platform AI service (first default text model). */
export function getPlatformDefaultLlmConfig(): LlmConfig | null {
  const settings = cachedPlatformSettings;
  const configs = settings.llmConfigs;
  const explicitDefault = configs.find((config) => config.isDefaultText);
  if (explicitDefault) return explicitDefault;
  if (settings.llmProvider !== "none" && settings.llmApiKey) {
    return {
      id: "platform-default",
      name: "Platform default",
      provider: settings.llmProvider,
      apiKey: settings.llmApiKey,
      model: "",
      isDefaultText: true,
    };
  }
  return null;
}
