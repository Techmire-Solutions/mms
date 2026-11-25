import { normalizeDashboardPreferences, type DashboardPreferences } from "@mms/contracts";
import {
  getDashboardPreferencesByWorkspace,
  getDashboardPreferencesWithUpdatedAt,
  saveDashboardPreferencesCas as saveDashboardPreferencesCasRepo,
  upsertDashboardPreferences,
  evictDashboardPreferencesCache as evictRepoCache,
} from "../db/repositories/dashboardPreferencesRepository.js";
import { createModulePreferencesService } from "../lib/createModulePreferencesService.js";
import { broadcastCollection } from "../lib/livePush.js";
import { requireTenant } from "../lib/tenantContext.js";
import { logger } from "../lib/logger.js";

const service = createModulePreferencesService<DashboardPreferences>({
  broadcastKey: "dashboard",
  getByWorkspace: getDashboardPreferencesByWorkspace,
  upsert: upsertDashboardPreferences,
  normalize: normalizeDashboardPreferences,
});

export const loadDashboardPreferences = service.load;
export const saveDashboardPreferences = service.save;

export interface DashboardPreferencesToken {
  preferences: DashboardPreferences;
  /** ISO datetime of the row `updated_at` the client must echo on the next PUT. */
  updatedAt: string | null;
}

/** Reads the preferences plus the OCC token (bypasses the json-only cache). */
export async function loadDashboardPreferencesToken(): Promise<DashboardPreferencesToken> {
  const tenant = requireTenant();
  const row = await getDashboardPreferencesWithUpdatedAt(tenant);
  return {
    preferences: normalizeDashboardPreferences(row?.preferences ?? null),
    updatedAt: row?.updatedAt ? row.updatedAt.toISOString() : null,
  };
}

/**
 * Compare-and-set save. Returns `null` when the echoed token no longer matches
 * the stored row (concurrent write) — the caller maps that to a 409.
 */
export async function saveDashboardPreferencesCas(
  preferences: DashboardPreferences,
  expectedUpdatedAt: string | null,
): Promise<DashboardPreferencesToken | null> {
  const tenant = requireTenant();
  const expected = expectedUpdatedAt ? new Date(expectedUpdatedAt) : null;
  const result = await saveDashboardPreferencesCasRepo(
    tenant,
    { ...preferences } as unknown as Record<string, unknown>,
    expected,
  );
  if (!result) return null;
  await broadcastCollection("dashboard");
  return {
    preferences: normalizeDashboardPreferences(result.preferences),
    updatedAt: result.updatedAt.toISOString(),
  };
}

/**
 * Re-evicts the cached singleton after the write transaction commits. The
 * factory's own eviction runs *inside* the transaction, so a concurrent reader
 * in that window can cache the pre-commit document for the full TTL.
 */
export async function evictDashboardPreferencesCache(): Promise<void> {
  try {
    await evictRepoCache(requireTenant());
  } catch (err) {
    // The write already committed — a failed eviction must not become a 500.
    logger.error({ err }, "Dashboard preferences cache eviction failed");
  }
}
