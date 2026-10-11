import { normalizeFinanceModulePreferences, type FinanceModulePreferences } from "@mms/shared";
import {
  getFinanceModulePreferencesByWorkspace,
  upsertFinanceModulePreferences,
} from "../db/repositories/financeModulePreferencesRepository.js";
import { createModulePreferencesService } from "../lib/createModulePreferencesService.js";

const service = createModulePreferencesService<FinanceModulePreferences>({
  broadcastKey: "finance",
  getByWorkspace: getFinanceModulePreferencesByWorkspace,
  upsert: upsertFinanceModulePreferences,
  normalize: normalizeFinanceModulePreferences,
});

export const loadFinanceModulePreferences = service.load;
export const saveFinanceModulePreferences = service.save;
