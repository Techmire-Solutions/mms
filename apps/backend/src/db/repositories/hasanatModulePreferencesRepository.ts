import { hasanatModulePreferences } from "../schema.js";
import { createWorkspaceSingletonJsonRepo } from "./moduleSetupRepoFactories.js";

const repo = createWorkspaceSingletonJsonRepo({
  table: hasanatModulePreferences,
  jsonColumn: "preferences",
}); // hasanatModulePreferences);

export const getHasanatModulePreferences = repo.getByWorkspace;
export const setHasanatModulePreferences = repo.upsert;
export const replaceHasanatModulePreferencesForWorkspace = repo.replaceForWorkspace;
export const listAllHasanatModulePreferencesByWorkspace = repo.listAllByWorkspace;
