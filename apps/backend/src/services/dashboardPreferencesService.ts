import { normalizeDashboardPreferences, type DashboardPreferences } from "@mms/shared";
import {
  getDashboardPreferencesByWorkspace,
  upsertDashboardPreferences,
  evictDashboardPreferencesCache as evictRepoCache,
} from "../db/repositories/dashboardPreferencesRepository.js";
import { createModulePreferencesService } from "../lib/createModulePreferencesService.js";
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
