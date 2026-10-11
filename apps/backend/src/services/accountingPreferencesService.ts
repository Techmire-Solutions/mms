import {
  normalizeAccountingModulePreferences,
  type AccountingModulePreferences,
} from "@mms/shared";
import {
  getAccountingModulePreferences,
  setAccountingModulePreferences,
} from "../db/repositories/accountingModulePreferencesRepository.js";
import { createModulePreferencesService } from "../lib/createModulePreferencesService.js";

const service = createModulePreferencesService<AccountingModulePreferences>({
  broadcastKey: "accounting",
  getByWorkspace: getAccountingModulePreferences,
  upsert: setAccountingModulePreferences,
  normalize: normalizeAccountingModulePreferences,
});

export const getAccountingPreferencesService = service.load;
export const updateAccountingPreferencesService = service.save;
