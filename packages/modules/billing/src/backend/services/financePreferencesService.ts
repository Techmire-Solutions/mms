import { normalizeFinanceModulePreferences, type FinanceModulePreferences } from "@mms/contracts";
import {
  getFinanceModulePreferencesByWorkspace,
  upsertFinanceModulePreferences,
} from "../repository/db/financeModulePreferencesRepository.js";
import { createModulePreferencesService } from "@mms/be-core/data/module-preferences";

const service = createModulePreferencesService<FinanceModulePreferences>({
  broadcastKey: "finance",
  getByWorkspace: getFinanceModulePreferencesByWorkspace,
  upsert: upsertFinanceModulePreferences,
  normalize: normalizeFinanceModulePreferences,
});

export const loadFinanceModulePreferences = service.load;
export const saveFinanceModulePreferences = service.save;
