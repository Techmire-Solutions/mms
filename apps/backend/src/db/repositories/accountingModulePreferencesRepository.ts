import { accountingModulePreferences } from "../schema.js";
import { createWorkspaceSingletonJsonRepo } from "./moduleSetupRepoFactories.js";

const repo = createWorkspaceSingletonJsonRepo({
  table: accountingModulePreferences,
  jsonColumn: "preferences",
});

export const getAccountingModulePreferences = repo.getByWorkspace;
export const setAccountingModulePreferences = repo.upsert;
export const evictAccountingModulePreferencesCache = repo.evictCache;
export const replaceAccountingModulePreferencesForWorkspace = repo.replaceForWorkspace;
export const listAllAccountingModulePreferencesByWorkspace = repo.listAllByWorkspace;
