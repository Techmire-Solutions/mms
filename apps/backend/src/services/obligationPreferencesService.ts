import {
  normalizeObligationsModulePreferences,
  type ObligationsModulePreferences,
  type User,
} from "@mms/shared";
import { obligationsRepository } from "../obligations/repository/obligationsRepositoryAdapter.js";
import { createModulePreferencesService } from "../lib/createModulePreferencesService.js";
import { createCollectionAuditHelper } from "../lib/createCollectionAuditHelper.js";

const auditObligations = createCollectionAuditHelper("obligation_collections");

const service = createModulePreferencesService<ObligationsModulePreferences>({
  broadcastKey: "obligations",
  getByWorkspace: (tenant) =>
    obligationsRepository.getPreferences
      ? obligationsRepository.getPreferences(tenant)
      : Promise.resolve(null),
  upsert: (tenant, payload) =>
    obligationsRepository.setPreferences
      ? obligationsRepository.setPreferences(tenant, payload)
      : Promise.resolve(),
  normalize: normalizeObligationsModulePreferences,
});

export const getObligationPreferencesService = service.load;

/**
 * Saves the module preferences and records the audit row.
 *
 * The audit used to be written by the contract router, so the controller owned a side effect and
 * any other caller of the service (a restore or an import) could change preferences with no audit
 * trail. The actor is now an argument: no actor, no audit row.
 */
export const updateObligationPreferencesService = async (
  preferences: ObligationsModulePreferences | Record<string, unknown>,
  actor?: User,
): Promise<ObligationsModulePreferences> => {
  const saved = await service.save(preferences);
  if (actor) {
    await auditObligations(
      actor,
      "UPDATE_OBLIGATIONS_PREFERENCES",
      "Updated obligations module preferences",
      "preferences",
      { newState: saved },
    );
  }
  return saved;
};
