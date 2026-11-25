import {
  DEFAULT_PLATFORM_BRANDING,
  mergePlatformBranding,
  mergePlatformSettings,
  toPublicPlatformBranding,
  type PlatformBrandingSettings,
  type PlatformBrandingUpdateInput,
  type PlatformSettings,
  type PublicPlatformBranding,
  type ThemeMode,
} from "@mms/contracts";
import { runInGlobalTransaction } from "@mms/db/client";
import {
  findPlatformBrandingRow,
  insertPlatformBrandingDefaultRow,
  upsertPlatformBrandingRow,
  upsertPlatformSettingsRow,
} from "../../platform/repository/platformSettingsAdapter.js";
import { logger } from "../../lib/logger.js";
import { redisGet, redisSet } from "../../lib/redis.js";
import { invalidateMultiTierCache } from "@mms/be-core/cache";
import {
  getPlatformSettings,
  setPlatformSettingsCache,
  REDIS_PLATFORM_SETTINGS_KEY,
} from "./platformSettingsService.js";

export const REDIS_PLATFORM_BRANDING_KEY = "platform:branding:global";

let cachedPlatformBranding: PlatformBrandingSettings = { ...DEFAULT_PLATFORM_BRANDING };

/** Initializes the in-memory branding cache; creates the singleton row when absent. */
export async function initPlatformBranding(): Promise<PlatformBrandingSettings> {
  try {
    const cached = await redisGet(REDIS_PLATFORM_BRANDING_KEY);
    if (cached) {
      try {
        cachedPlatformBranding = mergePlatformBranding(
          JSON.parse(cached) as Partial<PlatformBrandingSettings>,
        );
        return cachedPlatformBranding;
      } catch {
        // Fall through to the database.
      }
    }

    const existing = await findPlatformBrandingRow();
    cachedPlatformBranding = existing
      ? mergePlatformBranding(existing)
      : ((await insertPlatformBrandingDefaultRow()) ?? { ...DEFAULT_PLATFORM_BRANDING });

    try {
      await redisSet(REDIS_PLATFORM_BRANDING_KEY, JSON.stringify(cachedPlatformBranding), 86400);
    } catch {
      // Non-fatal
    }
  } catch (error) {
    logger.warn({ err: error }, "Failed to initialize platform branding; using defaults");
  }
  return cachedPlatformBranding;
}

/** Returns a copy of the cached platform branding. */
export function getPlatformBranding(): PlatformBrandingSettings {
  return { ...cachedPlatformBranding, socialLinks: [...cachedPlatformBranding.socialLinks] };
}

/** Replaces the in-memory branding cache after a transaction commits. */
export function setPlatformBrandingCache(next: PlatformBrandingSettings): void {
  cachedPlatformBranding = mergePlatformBranding(next);
}

/** Persists + caches a branding patch. */
export async function updatePlatformBranding(
  patch: PlatformBrandingUpdateInput,
): Promise<PlatformBrandingSettings> {
  const next = await upsertPlatformBrandingRow(
    mergePlatformBranding({ ...getPlatformBranding(), ...patch }),
  );
  setPlatformBrandingCache(next);
  try {
    await redisSet(REDIS_PLATFORM_BRANDING_KEY, JSON.stringify(next), 86400);
  } catch {
    // Non-fatal
  }
  await invalidateMultiTierCache({ tenantId: "platform", domain: "branding", key: "global" });
  return getPlatformBranding();
}

export interface PlatformAppearanceSaveInput {
  branding?: PlatformBrandingUpdateInput;
  themeMode?: ThemeMode;
  expectedUpdatedAt?: string;
}

export type PlatformAppearanceSaveResult =
  | { ok: true; branding: PlatformBrandingSettings; settings: PlatformSettings }
  | { ok: false; reason: "conflict" };

/**
 * Saves branding and the instance theme mode in one transaction so the Theme tab
 * can never persist colours without the matching display mode (or vice versa).
 */
export async function savePlatformAppearance(
  input: PlatformAppearanceSaveInput,
): Promise<PlatformAppearanceSaveResult> {
  const currentBranding = getPlatformBranding();
  const currentSettings = getPlatformSettings();

  if (input.expectedUpdatedAt && (currentBranding.updatedAt ?? "") !== input.expectedUpdatedAt) {
    return { ok: false, reason: "conflict" };
  }

  const nextBranding = mergePlatformBranding({
    ...currentBranding,
    ...(input.branding ?? {}),
  });
  const nextSettings = mergePlatformSettings(
    input.themeMode === undefined
      ? currentSettings
      : { ...currentSettings, themeMode: input.themeMode },
  );

  await runInGlobalTransaction(async () => {
    await upsertPlatformBrandingRow(nextBranding);
    await upsertPlatformSettingsRow(nextSettings);
  });

  const savedBranding = { ...nextBranding, updatedAt: new Date().toISOString() };
  setPlatformBrandingCache(savedBranding);
  setPlatformSettingsCache(nextSettings);
  try {
    await Promise.all([
      redisSet(REDIS_PLATFORM_BRANDING_KEY, JSON.stringify(savedBranding), 86400),
      redisSet(REDIS_PLATFORM_SETTINGS_KEY, JSON.stringify(nextSettings), 86400),
    ]);
  } catch {
    // Non-fatal
  }
  await Promise.all([
    invalidateMultiTierCache({ tenantId: "platform", domain: "branding", key: "global" }),
    invalidateMultiTierCache({ tenantId: "platform", domain: "settings", key: "global" }),
  ]);

  return { ok: true, branding: getPlatformBranding(), settings: getPlatformSettings() };
}

/** Public projection + the regional/theme values the apex boot needs. */
export function getPublicPlatformBrandingData(): {
  branding: PublicPlatformBranding;
  themeMode: ThemeMode;
  timezone: string;
  dateFormat: string;
  updatedAt?: string;
} {
  const branding = getPlatformBranding();
  const settings = getPlatformSettings();
  return {
    branding: toPublicPlatformBranding(branding),
    themeMode: settings.themeMode,
    timezone: settings.timezone,
    dateFormat: settings.dateFormat,
    ...(branding.updatedAt ? { updatedAt: branding.updatedAt } : {}),
  };
}

/** Keeps the platform settings cache in sync after a modules/LLM save (shared invalidation). */
export function syncPlatformSettingsCache(next: PlatformSettings): void {
  setPlatformSettingsCache(next);
}
