import { financeModulePreferences } from "../schema.js";
import { createWorkspaceSingletonJsonRepo } from "./moduleSetupRepoFactories.js";

const repo = createWorkspaceSingletonJsonRepo({
  table: financeModulePreferences,
  jsonColumn: "preferences",
});

export const getFinanceModulePreferencesByWorkspace = repo.getByWorkspace;
export const upsertFinanceModulePreferences = repo.upsert;
export const listAllFinanceModulePreferencesByWorkspace = repo.listAllByWorkspace;
export const replaceFinanceModulePreferencesForWorkspace = repo.replaceForWorkspace;
