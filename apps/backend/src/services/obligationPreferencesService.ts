import {
  normalizeObligationsModulePreferences,
  type ObligationsModulePreferences,
} from "@mms/shared";
import { obligationsRepository } from "../obligations/repository/obligationsRepositoryAdapter.js";
import { createModulePreferencesService } from "../lib/createModulePreferencesService.js";

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
export const updateObligationPreferencesService = service.save;
