import { financeModulePreferences } from "@mms/db/schema";
import { createWorkspaceSingletonJsonRepo } from "@mms/be-core/data";

const repo = createWorkspaceSingletonJsonRepo({
  table: financeModulePreferences,
  jsonColumn: "preferences",
});

export const getFinanceModulePreferencesByWorkspace = repo.getByWorkspace;
export const upsertFinanceModulePreferences = repo.upsert;
export const listAllFinanceModulePreferencesByWorkspace = repo.listAllByWorkspace;
export const replaceFinanceModulePreferencesForWorkspace = repo.replaceForWorkspace;
