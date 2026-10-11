import type { PlatformSettings, PlatformSettingsUpdateInput } from "@mms/shared";
import { DEFAULT_PLATFORM_SETTINGS } from "@mms/shared";
import {
  findPlatformSettingsRow,
  insertPlatformSettingsDefaultRow,
  upsertPlatformSettingsRow,
} from "../../db/repositories/platformSettingsRepository.js";
import { logger } from "../../lib/logger.js";
import { redisGet, redisSet } from "../../lib/redis.js";
import { invalidateMultiTierCache } from "../../lib/cache/index.js";

export const REDIS_PLATFORM_SETTINGS_KEY = "platform:settings:global";

let cachedPlatformSettings: PlatformSettings = { ...DEFAULT_PLATFORM_SETTINGS };

/**
 * Initializes the in-memory platform settings cache from Redis or PostgreSQL on server startup.
 * Creates the single 'global' row if it does not exist yet.
 */
export async function initPlatformSettings(): Promise<PlatformSettings> {
  try {
    const cached = await redisGet(REDIS_PLATFORM_SETTINGS_KEY);
    if (cached) {
      try {
        cachedPlatformSettings = JSON.parse(cached) as PlatformSettings;
        return cachedPlatformSettings;
      } catch {
        // Fall back to database query
      }
    }

    const existing = await findPlatformSettingsRow();
    if (existing) {
      cachedPlatformSettings = existing;
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
        cachedPlatformSettings = inserted;
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
  return { ...cachedPlatformSettings };
}

/**
 * Updates platform settings in PostgreSQL and updates the in-memory cache and L2 Redis instantly.
 */
export async function updatePlatformSettings(
  input: PlatformSettingsUpdateInput,
): Promise<PlatformSettings> {
  const current = getPlatformSettings();
  const next = await upsertPlatformSettingsRow(input, current);
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
  return { ...cachedPlatformSettings };
}
